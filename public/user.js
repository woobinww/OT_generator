const elements = {
  loginPanel: document.querySelector("#loginPanel"),
  summaryPanel: document.querySelector("#summaryPanel"),
  passwordPanel: document.querySelector("#passwordPanel"),
  calendarPanel: document.querySelector("#calendarPanel"),
  loginForm: document.querySelector("#loginForm"),
  usernameInput: document.querySelector("#usernameInput"),
  passwordInput: document.querySelector("#passwordInput"),
  loginButton: document.querySelector("#loginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  changePasswordToggleButton: document.querySelector("#changePasswordToggleButton"),
  monthInput: document.querySelector("#monthInput"),
  reloadButton: document.querySelector("#reloadButton"),
  previousMonthButton: document.querySelector("#previousMonthButton"),
  todayMonthButton: document.querySelector("#todayMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  lastUpdatedText: document.querySelector("#lastUpdatedText"),
  calendarLoading: document.querySelector("#calendarLoading"),
  summaryTitle: document.querySelector("#summaryTitle"),
  summaryCards: document.querySelector("#summaryCards"),
  calendarTitle: document.querySelector("#calendarTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  allAttendanceButton: document.querySelector("#allAttendanceButton"),
  myAttendanceButton: document.querySelector("#myAttendanceButton"),
  currentPasswordInput: document.querySelector("#currentPasswordInput"),
  newPasswordInput: document.querySelector("#newPasswordInput"),
  changePasswordButton: document.querySelector("#changePasswordButton"),
  messageBox: document.querySelector("#messageBox")
};

let currentUser = null;
let onlyMyAttendance = false;
let currentCalendarData = null;

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
  elements.loginPanel.classList.add("hidden");
  elements.summaryPanel.classList.remove("hidden");
  elements.passwordPanel.classList.add("hidden");
  elements.calendarPanel.classList.remove("hidden");
  try {
    hideMessage();
    const calendarPayload = await loadCalendar();
    await loadSummary(calendarPayload.data);
  } catch (error) {
    showMessage(`데이터를 불러오지 못했습니다. ${error.message} 새로고침하거나 잠시 후 다시 시도해 주세요.`, "error");
  }
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

async function loadSummary(calendarData = null) {
  const month = elements.monthInput.value;
  const payload = await api(`/api/me/monthly-summary?month=${encodeURIComponent(month)}`);
  const summary = payload.summary;
  if (!summary) {
    elements.summaryCards.innerHTML = "";
    showMessage("연결된 직원 요약 데이터가 없습니다.", "error");
    return;
  }

  const data = calendarData || currentCalendarData;
  const viewerEmployeeId = String(currentUser.employeeId || "");
  const earlyOtCount = data?.records.filter(record => record.needsOt &&
    [record.mriEmployeeId, record.xrayEmployeeId].some(id => String(id || "") === viewerEmployeeId)).length || 0;
  const nightCount = data?.records.filter(record =>
    [record.nightMriEmployeeId, record.nightXrayEmployeeId].some(id => String(id || "") === viewerEmployeeId)).length || 0;
  const saturdayWorkCount = data?.attendanceRecords.filter(record =>
    String(record.employeeId || "") === viewerEmployeeId &&
    new Date(`${record.date}T00:00:00`).getDay() === 6 &&
    record.off !== "토요일OFF" && Number(record.holidayOt || 0) > 0).length || 0;

  elements.summaryTitle.textContent = "월간 근태 요약";
  elements.summaryCards.innerHTML = `
    <div class="summary-group summary-combined-group">
      ${[
        ["조출", `${earlyOtCount}회`],
        ["야간", `${nightCount}회`],
        ["토요일", `${saturdayWorkCount}회`],
        ["총 OT", `${formatValue(summary.totalOt)}시간`],
        ["야간 OT", `${formatValue(summary.nightOt)}시간`]
      ].map(([label, value]) => renderSummaryCard(label, value)).join("")}
    </div>
  `;
}

function renderSummaryCard(label, value) {
  return `
    <article class="summary-card">
      <span>${label}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

async function loadCalendar() {
  const month = elements.monthInput.value;
  elements.calendarLoading.classList.remove("hidden");
  elements.calendarGrid.classList.add("is-loading");
  elements.reloadButton.disabled = true;
  try {
    const payload = await api(`/api/calendar?month=${encodeURIComponent(month)}`);
    currentCalendarData = payload.data;
    renderCalendar(payload.month, payload.data, payload.viewerEmployeeId);
    elements.lastUpdatedText.textContent = `마지막 갱신 ${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
    return payload;
  } finally {
    elements.calendarLoading.classList.add("hidden");
    elements.calendarGrid.classList.remove("is-loading");
    elements.reloadButton.disabled = false;
  }
}

function renderCalendar(month, data, viewerEmployeeId) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDate = new Date(year, monthNumber - 1, 1);
  const lastDate = new Date(year, monthNumber, 0);
  const today = new Date();
  const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const cells = [];

  elements.calendarTitle.textContent = `${year}년 ${monthNumber}월 근무 달력`;
  updateAttendanceModeButtons();

  for (let index = 0; index < firstDate.getDay(); index += 1) {
    cells.push(`<div class="calendar-day is-empty"></div>`);
  }

  for (let day = 1; day <= lastDate.getDate(); day += 1) {
    const dateText = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(year, monthNumber - 1, day).getDay();
    const dayContent = buildCalendarDayContent(dateText, data, viewerEmployeeId, onlyMyAttendance);
    const hasData = dayContent.otText || dayContent.middleText || dayContent.nightText;
    const dayClasses = ["calendar-day"];
    if (hasData) dayClasses.push("has-data");
    if (dateText === todayText) dayClasses.push("is-today");
    if (weekday === 0) dayClasses.push("is-sunday");
    if (weekday === 6) dayClasses.push("is-saturday");
    cells.push(`
      <div class="${dayClasses.join(" ")}">
        <div class="calendar-day-watermark" aria-hidden="true">${day}</div>
        <div class="calendar-day-info">
          <span class="${dayContent.otText ? "calendar-day-note" : "calendar-day-note-empty"}">${escapeHtml(dayContent.otText || "-")}</span>
          <span class="${dayContent.middleText ? "calendar-day-note calendar-day-note-off" : "calendar-day-note-empty"}">${escapeHtml(dayContent.middleText || "-")}</span>
          <span class="${dayContent.nightText ? "calendar-day-note calendar-day-note-night" : "calendar-day-note-empty calendar-day-note-night"}">${escapeHtml(dayContent.nightText || "-")}</span>
        </div>
      </div>
    `);
  }

  elements.calendarGrid.innerHTML = cells.join("");
}

function updateAttendanceModeButtons() {
  elements.allAttendanceButton.classList.toggle("primary", !onlyMyAttendance);
  elements.myAttendanceButton.classList.toggle("primary", onlyMyAttendance);
  elements.allAttendanceButton.setAttribute("aria-pressed", String(!onlyMyAttendance));
  elements.myAttendanceButton.setAttribute("aria-pressed", String(onlyMyAttendance));
}

function setAttendanceMode(mineOnly, focusButton = false) {
  onlyMyAttendance = mineOnly;
  updateAttendanceModeButtons();
  if (focusButton) {
    (mineOnly ? elements.myAttendanceButton : elements.allAttendanceButton).focus();
  }
  loadCalendar();
}

function handleAttendanceModeKeydown(event) {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    setAttendanceMode(false, true);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    setAttendanceMode(true, true);
  }
}

function shiftMonth(offset) {
  const [year, month] = elements.monthInput.value.split("-").map(Number);
  const target = new Date(year, month - 1 + offset, 1);
  elements.monthInput.value = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  loadDashboard();
}

function goToToday() {
  elements.monthInput.value = getTodayMonth();
  loadDashboard();
}

function buildCalendarDayContent(dateText, data, viewerEmployeeId, mineOnly = false) {
  const record = data.records.find(item => item.date === dateText);
  const dayAttendanceRecords = data.attendanceRecords.filter(item => item.date === dateText);
  const attendanceRecords = mineOnly
    ? dayAttendanceRecords.filter(item => String(item.employeeId || "") === String(viewerEmployeeId || ""))
    : dayAttendanceRecords;
  const isMine = employeeId => String(employeeId || "") === String(viewerEmployeeId || "");
  const otText = record?.needsOt && (!mineOnly || isMine(record.mriEmployeeId) || isMine(record.xrayEmployeeId))
    ? `조: ${mineOnly
      ? [record.mriEmployeeId, record.xrayEmployeeId]
        .filter(isMine)
        .map(employeeId => formatOwnAssignment(attendanceRecords, employeeId, viewerEmployeeId, "otEarned"))
        .join("/")
      : `${formatAssignmentName(data, attendanceRecords, record.mriEmployeeId, viewerEmployeeId, "otEarned")}/${formatAssignmentName(data, attendanceRecords, record.xrayEmployeeId, viewerEmployeeId, "otEarned")}`}`
    : "";
  const nightText = (record?.nightMriEmployeeId || record?.nightXrayEmployeeId) &&
    (!mineOnly || isMine(record.nightMriEmployeeId) || isMine(record.nightXrayEmployeeId))
    ? `야: ${mineOnly
      ? [record.nightMriEmployeeId, record.nightXrayEmployeeId]
        .filter(isMine)
        .map(employeeId => formatOwnAssignment(attendanceRecords, employeeId, viewerEmployeeId, "nightOt"))
        .join("/")
      : `${formatAssignmentName(data, attendanceRecords, record.nightMriEmployeeId, viewerEmployeeId, "nightOt")}/${formatAssignmentName(data, attendanceRecords, record.nightXrayEmployeeId, viewerEmployeeId, "nightOt")}`}`
    : "";

  const saturdayOffNames = attendanceRecords
    .filter(recordItem => recordItem.off === "토요일OFF")
    .map(recordItem => givenName(recordItem.name));
  const attendanceLines = attendanceRecords
    .filter(recordItem => recordItem.off !== "토요일OFF")
    .map(recordItem => buildAttendanceLine(recordItem, viewerEmployeeId, record, mineOnly))
    .filter(Boolean);

  if (saturdayOffNames.length) {
    attendanceLines.unshift(`OFF: ${saturdayOffNames.join("/")}`);
  }

  return {
    otText,
    middleText: attendanceLines.join("\n"),
    nightText
  };
}

function buildAttendanceLine(recordItem, viewerEmployeeId, workRecord, mineOnly = false) {
  const isMine = String(recordItem.employeeId || "") === String(viewerEmployeeId || "");
  const isAssignedToEarlyOt = Boolean(workRecord?.needsOt) &&
    (String(workRecord.mriEmployeeId || "") === String(recordItem.employeeId || "") ||
      String(workRecord.xrayEmployeeId || "") === String(recordItem.employeeId || ""));
  const details = [];
  if (recordItem.off) details.push(shortOff(recordItem.off));
  if (recordItem.otUsed < 0) details.push(`OT ${recordItem.otUsed}`);
  if (isMine && recordItem.otEarned > 0 && !isAssignedToEarlyOt) details.push(`OT ${recordItem.otEarned}`);
  if (isMine && recordItem.holidayOt > 0) details.push(`휴일 ${recordItem.holidayOt}`);
  if (recordItem.flexOt < 0) details.push(`탄력 ${recordItem.flexOt}`);
  if (isMine && recordItem.flexOt > 0) details.push(`탄력 ${recordItem.flexOt}`);
  const manualNote = stripAutoOtNotePrefix(recordItem.note);
  const hasOwnPositiveOt = (recordItem.otEarned > 0 && !isAssignedToEarlyOt) || recordItem.holidayOt > 0;
  if (isMine && hasOwnPositiveOt && manualNote) details.push(manualNote);
  return details.length ? (mineOnly ? details.join(" ") : `${givenName(recordItem.name)} ${details.join(" ")}`) : "";
}

function formatOwnAssignment(attendanceRecords, employeeId, viewerEmployeeId, timeField) {
  if (String(employeeId || "") !== String(viewerEmployeeId || "")) return "";
  const attendanceRecord = attendanceRecords.find(item => String(item.employeeId || "") === String(employeeId || ""));
  const timeValue = Number(attendanceRecord?.[timeField] || 0);
  return timeValue > 0 ? formatValue(timeValue) : "있음";
}

function getEmployeeName(data, employeeId) {
  const employee = data.employees.find(item => item.id === String(employeeId));
  return employee ? givenName(employee.name) : "-";
}

function formatAssignmentName(data, attendanceRecords, employeeId, viewerEmployeeId, timeField) {
  const employee = data.employees.find(item => item.id === String(employeeId));
  if (!employee) return "-";
  const name = givenName(employee.name);
  if (String(employee.id) !== String(viewerEmployeeId || "")) return name;

  const attendanceRecord = attendanceRecords.find(item => String(item.employeeId || "") === String(employee.id));
  const timeValue = Number(attendanceRecord?.[timeField] || 0);
  return timeValue > 0 ? `${name}(${formatValue(timeValue)})` : name;
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

function stripAutoOtNotePrefix(noteText) {
  let remainingText = String(noteText || "");
  const autoTokenPattern = /(?:^|\s*\+\s*|\s+)(?:OT\([^)]*\)|OT사용 반차\([^)]*\)|OT사용 off\([^)]*\)|OT사용\([^)]*\)|탄력\s+[^()\s][^()]*\([^)]*\)|탄력사용\([^)]*\)|탄력 사용\([^)]*\))/;

  while (true) {
    remainingText = remainingText.trim();
    const before = remainingText;
    remainingText = remainingText.replace(autoTokenPattern, " ").replace(/\s*\+\s*$/, "").trim();
    if (remainingText === before) break;
  }

  return remainingText;
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
elements.loginForm.addEventListener("submit", event => {
  event.preventDefault();
  login();
});
elements.logoutButton.addEventListener("click", logout);
elements.changePasswordToggleButton.addEventListener("click", togglePasswordPanel);
elements.changePasswordButton.addEventListener("click", changeOwnPassword);
elements.reloadButton.addEventListener("click", loadDashboard);
elements.monthInput.addEventListener("change", loadDashboard);
elements.previousMonthButton.addEventListener("click", () => shiftMonth(-1));
elements.todayMonthButton.addEventListener("click", goToToday);
elements.nextMonthButton.addEventListener("click", () => shiftMonth(1));
elements.allAttendanceButton.addEventListener("click", () => setAttendanceMode(false));
elements.myAttendanceButton.addEventListener("click", () => setAttendanceMode(true));
elements.allAttendanceButton.addEventListener("keydown", handleAttendanceModeKeydown);
elements.myAttendanceButton.addEventListener("keydown", handleAttendanceModeKeydown);

checkSession();
