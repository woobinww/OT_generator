const elements = {
  loginPanel: document.querySelector("#loginPanel"),
  summaryPanel: document.querySelector("#summaryPanel"),
  passwordPanel: document.querySelector("#passwordPanel"),
  calendarPanel: document.querySelector("#calendarPanel"),
  usernameInput: document.querySelector("#usernameInput"),
  passwordInput: document.querySelector("#passwordInput"),
  loginButton: document.querySelector("#loginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  changePasswordToggleButton: document.querySelector("#changePasswordToggleButton"),
  monthInput: document.querySelector("#monthInput"),
  reloadButton: document.querySelector("#reloadButton"),
  summaryTitle: document.querySelector("#summaryTitle"),
  summaryCards: document.querySelector("#summaryCards"),
  calendarTitle: document.querySelector("#calendarTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  currentPasswordInput: document.querySelector("#currentPasswordInput"),
  newPasswordInput: document.querySelector("#newPasswordInput"),
  changePasswordButton: document.querySelector("#changePasswordButton"),
  messageBox: document.querySelector("#messageBox")
};

let currentUser = null;

function getTodayMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "요청에 실패했습니다.");
  return payload;
}

function showMessage(message, type = "info") {
  elements.messageBox.textContent = message;
  elements.messageBox.classList.remove("hidden", "error");
  if (type === "error") elements.messageBox.classList.add("error");
}

function hideMessage() {
  elements.messageBox.classList.add("hidden");
}

async function login() {
  try {
    const username = elements.usernameInput.value.trim();
    const password = elements.passwordInput.value;
    const payload = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    currentUser = payload.user;
    elements.passwordInput.value = "";
    if (currentUser.role === "admin") {
      window.location.href = "./index.html";
      return;
    }
    await loadDashboard();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
  currentUser = null;
  window.location.href = "./index.html";
}

async function checkSession() {
  try {
    const payload = await api("/api/auth/me");
    currentUser = payload.user;
    if (currentUser.role === "admin") {
      window.location.href = "./index.html";
      return;
    }
    await loadDashboard();
  } catch {
    elements.loginPanel.classList.remove("hidden");
  }
}

async function loadDashboard() {
  hideMessage();
  elements.loginPanel.classList.add("hidden");
  elements.summaryPanel.classList.remove("hidden");
  elements.passwordPanel.classList.add("hidden");
  elements.calendarPanel.classList.remove("hidden");
  await Promise.all([loadSummary(), loadCalendar()]);
}

function togglePasswordPanel() {
  elements.passwordPanel.classList.toggle("hidden");
}

async function changeOwnPassword() {
  try {
    const currentPassword = elements.currentPasswordInput.value;
    const newPassword = elements.newPasswordInput.value;
    await api("/api/auth/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    });
    elements.currentPasswordInput.value = "";
    elements.newPasswordInput.value = "";
    elements.passwordPanel.classList.add("hidden");
    showMessage("비밀번호를 변경했습니다.");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadSummary() {
  const month = elements.monthInput.value;
  const payload = await api(`/api/me/monthly-summary?month=${encodeURIComponent(month)}`);
  const summary = payload.summary;
  if (!summary) {
    elements.summaryCards.innerHTML = "";
    showMessage("연결된 직원 요약 데이터가 없습니다.", "error");
    return;
  }

  elements.summaryTitle.textContent = `${summary.name} ${payload.month} 요약`;
  elements.summaryCards.innerHTML = [
    ["ot 합계", summary.totalOt],
    ["OT 한 시간", summary.otEarned],
    ["OT 사용", summary.otUsed],
    ["nightOt", summary.nightOt],
    ["holidayOt", summary.holidayOt],
    ["flexOt", summary.flexOt],
    ["연차", summary.annualLeaveCount],
    ["전반/후반", `${summary.morningHalfCount}/${summary.afternoonHalfCount}`]
  ].map(([label, value]) => `
    <article class="summary-card">
      <span>${label}</span>
      <strong>${formatValue(value)}</strong>
    </article>
  `).join("");
}

async function loadCalendar() {
  const month = elements.monthInput.value;
  const payload = await api(`/api/calendar?month=${encodeURIComponent(month)}`);
  renderCalendar(payload.month, payload.data, payload.viewerEmployeeId);
}

function renderCalendar(month, data, viewerEmployeeId) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDate = new Date(year, monthNumber - 1, 1);
  const lastDate = new Date(year, monthNumber, 0);
  const cells = [];

  elements.calendarTitle.textContent = `${year}년 ${monthNumber}월 근무 달력`;

  for (let index = 0; index < firstDate.getDay(); index += 1) {
    cells.push(`<div class="calendar-day is-empty"></div>`);
  }

  for (let day = 1; day <= lastDate.getDate(); day += 1) {
    const dateText = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const lines = buildCalendarLines(dateText, data, viewerEmployeeId);
    cells.push(`
      <div class="calendar-day ${lines ? "has-data" : ""}">
        <div class="calendar-day-number">${day}</div>
        <div class="calendar-day-lines">${escapeHtml(lines)}</div>
      </div>
    `);
  }

  elements.calendarGrid.innerHTML = cells.join("");
}

function buildCalendarLines(dateText, data, viewerEmployeeId) {
  const lines = [];
  const record = data.records.find(item => item.date === dateText);
  const attendanceRecords = data.attendanceRecords.filter(item => item.date === dateText);

  if (record?.needsOt) {
    lines.push(`OT: ${getEmployeeName(data, record.mriEmployeeId)}/${getEmployeeName(data, record.xrayEmployeeId)}`);
  }

  attendanceRecords.forEach(recordItem => {
    const isMine = String(recordItem.employeeId || "") === String(viewerEmployeeId || "");
    const details = [];
    if (recordItem.off) details.push(recordItem.off === "토요일OFF" ? "OFF" : shortOff(recordItem.off));
    if (isMine && recordItem.otUsed < 0) details.push(`OT ${recordItem.otUsed}`);
    if (isMine && recordItem.flexOt !== 0) details.push(`탄력 ${recordItem.flexOt}`);
    if (details.length) lines.push(`${givenName(recordItem.name)} ${details.join(" ")}`);
  });

  if (record?.nightMriEmployeeId || record?.nightXrayEmployeeId) {
    lines.push(`야간: ${getEmployeeName(data, record.nightMriEmployeeId)}/${getEmployeeName(data, record.nightXrayEmployeeId)}`);
  }

  return lines.join("\n");
}

function getEmployeeName(data, employeeId) {
  const employee = data.employees.find(item => item.id === String(employeeId));
  return employee ? givenName(employee.name) : "-";
}

function givenName(name) {
  const value = String(name || "").trim();
  if (!value) return "-";
  return value.length > 1 ? value.slice(1) : value;
}

function shortOff(value) {
  if (value === "오전반차") return "전반";
  if (value === "오후반차") return "후반";
  return value;
}

function formatValue(value) {
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  return String(value ?? 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.monthInput.value = getTodayMonth();
elements.loginButton.addEventListener("click", login);
elements.logoutButton.addEventListener("click", logout);
elements.changePasswordToggleButton.addEventListener("click", togglePasswordPanel);
elements.changePasswordButton.addEventListener("click", changeOwnPassword);
elements.reloadButton.addEventListener("click", loadDashboard);
elements.monthInput.addEventListener("change", loadDashboard);

checkSession();
