const weekdayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const storageKey = "earlyOtFairSchedulerData";

const defaultSettings = {
  operatingDays: [1, 2, 3, 4, 5, 6],
  defaultOtDays: [2, 3, 4, 5, 6],
  excludeMondayByDefault: true,
  dailyOtCount: 2,
  requiredMriCount: 1,
  allowConsecutive: false,
  maxMonthlyDifference: 2,
  createBackup: true
};

const sampleEmployees = [
  {
    id: "emp_sample_001",
    name: "김민수",
    canMri: true,
    isOtEligible: true,
    isNightEligible: true
  },
  {
    id: "emp_sample_002",
    name: "이서연",
    canMri: true,
    isOtEligible: true,
    isNightEligible: true
  },
  {
    id: "emp_sample_003",
    name: "박지훈",
    canMri: false,
    isOtEligible: true,
    isNightEligible: true
  },
  {
    id: "emp_sample_004",
    name: "최유진",
    canMri: false,
    isOtEligible: true,
    isNightEligible: true
  }
];

let appData = {
  employees: [],
  records: [],
  exceptions: [],
  settings: {}
};

let currentRecommendation = null;

const elements = {
  selectedDateInput: document.querySelector("#selectedDateInput"),
  selectedDateDisplay: document.querySelector("#selectedDateDisplay"),
  selectedWeekday: document.querySelector("#selectedWeekday"),
  previousMonthButton: document.querySelector("#previousMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  calendarMonthLabel: document.querySelector("#calendarMonthLabel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  showOtInputButton: document.querySelector("#showOtInputButton"),
  showNightInputButton: document.querySelector("#showNightInputButton"),
  otInputSection: document.querySelector("#otInputSection"),
  nightInputSection: document.querySelector("#nightInputSection"),
  recommendButton: document.querySelector("#recommendButton"),
  tomorrowPreviewButton: document.querySelector("#tomorrowPreviewButton"),
  algorithmHelpButton: document.querySelector("#algorithmHelpButton"),
  algorithmHelpDialog: document.querySelector("#algorithmHelpDialog"),
  algorithmHelpCloseButton: document.querySelector("#algorithmHelpCloseButton"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  backupJsonButton: document.querySelector("#backupJsonButton"),
  restoreJsonButton: document.querySelector("#restoreJsonButton"),
  restoreJsonInput: document.querySelector("#restoreJsonInput"),
  messageBox: document.querySelector("#messageBox"),
  warningBox: document.querySelector("#warningBox"),
  mriRecommendationName: document.querySelector("#mriRecommendationName"),
  mriRecommendationReason: document.querySelector("#mriRecommendationReason"),
  xrayRecommendationName: document.querySelector("#xrayRecommendationName"),
  xrayRecommendationReason: document.querySelector("#xrayRecommendationReason"),
  alternateMriButton: document.querySelector("#alternateMriButton"),
  alternateXrayButton: document.querySelector("#alternateXrayButton"),
  manualMriSelect: document.querySelector("#manualMriSelect"),
  manualXraySelect: document.querySelector("#manualXraySelect"),
  nightMriSelect: document.querySelector("#nightMriSelect"),
  nightXraySelect: document.querySelector("#nightXraySelect"),
  recordMemoInput: document.querySelector("#recordMemoInput"),
  confirmRecordButton: document.querySelector("#confirmRecordButton"),
  resetFormButton: document.querySelector("#resetFormButton"),
  fairnessStatus: document.querySelector("#fairnessStatus"),
  monthlySummaryBody: document.querySelector("#monthlySummaryBody"),
  employeeForm: document.querySelector("#employeeForm"),
  employeeIdInput: document.querySelector("#employeeIdInput"),
  employeeNameInput: document.querySelector("#employeeNameInput"),
  employeeCanMriInput: document.querySelector("#employeeCanMriInput"),
  employeeEligibleInput: document.querySelector("#employeeEligibleInput"),
  employeeNightEligibleInput: document.querySelector("#employeeNightEligibleInput"),
  cancelEmployeeEditButton: document.querySelector("#cancelEmployeeEditButton"),
  employeeTableBody: document.querySelector("#employeeTableBody"),
  recordTableBody: document.querySelector("#recordTableBody")
};

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getTodayText() {
  return formatLocalDate(new Date());
}

function addDays(dateText, days) {
  const date = parseLocalDate(dateText);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

function getMonthKey(dateText) {
  return dateText.slice(0, 7);
}

function getWeekday(dateText) {
  return parseLocalDate(dateText).getDay();
}

function formatKoreanDate(dateText) {
  return `${dateText} ${weekdayNames[getWeekday(dateText)]}`;
}

function getEmployeeName(employeeId) {
  const employee = appData.employees.find(item => item.id === employeeId);
  return employee ? employee.name : "-";
}

function getGivenNameOnly(employeeId) {
  const fullName = getEmployeeName(employeeId).trim();
  if (!fullName || fullName === "-") return "-";
  if (fullName.includes(" ")) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    return parts[parts.length - 1] || fullName;
  }
  return fullName.length > 1 ? fullName.slice(1) : fullName;
}

function showMessage(message, type = "info") {
  elements.messageBox.textContent = message;
  elements.messageBox.classList.remove("hidden");
  elements.messageBox.style.background = type === "error" ? "#ffe0dd" : "#e9f5ef";
  elements.messageBox.style.color = type === "error" ? "#9f241c" : "#144b36";
}

function hideMessage() {
  elements.messageBox.classList.add("hidden");
}

function setWarnings(warnings) {
  if (!warnings.length) {
    elements.warningBox.classList.add("hidden");
    elements.warningBox.innerHTML = "";
    return;
  }
  elements.warningBox.classList.remove("hidden");
  elements.warningBox.innerHTML = warnings.map(warning => `<div>${escapeHtml(warning)}</div>`).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createInitialData() {
  return {
    employees: sampleEmployees,
    records: [],
    exceptions: [],
    settings: defaultSettings
  };
}

function normalizeData(data) {
  return {
    employees: Array.isArray(data.employees) ? data.employees.map(normalizeEmployee) : [],
    records: Array.isArray(data.records) ? data.records.map(normalizeRecord) : [],
    exceptions: Array.isArray(data.exceptions) ? data.exceptions : [],
    settings: { ...defaultSettings, ...(data.settings || {}) }
  };
}

function normalizeEmployee(employee) {
  return {
    id: employee.id || `emp_${Date.now()}`,
    name: employee.name || "",
    canMri: Boolean(employee.canMri),
    isOtEligible: employee.isOtEligible !== false,
    isNightEligible: employee.isNightEligible !== false
  };
}

function normalizeRecord(record) {
  return {
    date: record.date || "",
    needsOt: Boolean(record.needsOt),
    mriEmployeeId: record.mriEmployeeId || "",
    xrayEmployeeId: record.xrayEmployeeId || "",
    nightMriEmployeeId: record.nightMriEmployeeId || "",
    nightXrayEmployeeId: record.nightXrayEmployeeId || "",
    memo: record.memo || ""
  };
}

function validateImportedData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("백업 파일 구조가 올바르지 않습니다.");
  }
  if (!Array.isArray(data.employees) || !Array.isArray(data.records)) {
    throw new Error("직원 정보 또는 기록 목록이 없는 백업 파일입니다.");
  }
}

function loadData() {
  const savedData = localStorage.getItem(storageKey);
  if (!savedData) {
    appData = createInitialData();
    saveData();
    return;
  }

  appData = normalizeData(JSON.parse(savedData));
}

function saveData() {
  localStorage.setItem(storageKey, JSON.stringify(appData));
}

function getEligibleEmployees() {
  return appData.employees.filter(employee => employee.isOtEligible);
}

function getMonthlyRecords(monthKey) {
  return appData.records.filter(record => record.date.startsWith(monthKey) && record.needsOt);
}

function buildEmployeeStats(monthKey) {
  const stats = new Map();

  appData.employees.forEach(employee => {
    stats.set(employee.id, {
      employee,
      total: 0,
      mri: 0,
      xray: 0,
      lastDate: "",
      consecutive: false
    });
  });

  const records = getMonthlyRecords(monthKey).sort((a, b) => a.date.localeCompare(b.date));
  records.forEach(record => {
    [
      { id: record.mriEmployeeId, role: "mri" },
      { id: record.xrayEmployeeId, role: "xray" }
    ].forEach(assignment => {
      if (!assignment.id || !stats.has(assignment.id)) return;
      const item = stats.get(assignment.id);
      item.total += 1;
      item[assignment.role] += 1;
      if (item.lastDate && addDays(item.lastDate, 1) === record.date) {
        item.consecutive = true;
      }
      item.lastDate = record.date;
    });
  });

  return stats;
}

function wasAssignedOnDate(employeeId, dateText) {
  return appData.records.some(record => {
    return record.date === dateText &&
      record.needsOt &&
      (record.mriEmployeeId === employeeId || record.xrayEmployeeId === employeeId);
  });
}

function getPreviousOtRecordDate(dateText) {
  const previousOtRecords = appData.records
    .filter(record => record.needsOt && record.date < dateText)
    .sort((a, b) => b.date.localeCompare(a.date));

  return previousOtRecords[0]?.date || "";
}

function wasAssignedOnPreviousOtDate(employeeId, dateText) {
  const previousOtDate = getPreviousOtRecordDate(dateText);
  if (!previousOtDate) {
    return { assigned: false, previousOtDate: "" };
  }

  return {
    assigned: wasAssignedOnDate(employeeId, previousOtDate),
    previousOtDate
  };
}

function scoreCandidate(employee, role, dateText, stats, options = {}) {
  const employeeStats = stats.get(employee.id) || { total: 0, mri: 0, xray: 0, lastDate: "" };
  const previousOtCheck = wasAssignedOnPreviousOtDate(employee.id, dateText);
  const reasons = [];
  const warnings = [];
  let score = 0;

  score += employeeStats.total * 100;
  reasons.push(`이번 달 총 OT ${employeeStats.total}회`);

  if (role === "mri") {
    score += employeeStats.mri * 35;
    reasons.push(`MRI 담당 ${employeeStats.mri}회`);
  } else {
    score += employeeStats.xray * 35;
    reasons.push(`X-ray 담당 ${employeeStats.xray}회`);
  }

  if (previousOtCheck.assigned) {
    score += options.allowPreviousOt ? 120 : 700;
    warnings.push(`직전 조기출근일(${previousOtCheck.previousOtDate}) 근무 이력이 있어 우선순위를 낮췄습니다.`);
    reasons.push(`직전 조기출근일(${previousOtCheck.previousOtDate}) 근무`);
  } else if (previousOtCheck.previousOtDate) {
    reasons.push(`직전 조기출근일(${previousOtCheck.previousOtDate}) 근무 아님`);
  } else {
    reasons.push("이전 조기출근 기록 없음");
  }

  if (!employeeStats.lastDate) {
    score -= 10;
    reasons.push("이번 달 아직 배정되지 않았거나 배정이 적음");
  } else {
    const daysSinceLastOt = Math.max(0, Math.floor((parseLocalDate(dateText) - parseLocalDate(employeeStats.lastDate)) / 86400000));
    score -= Math.min(daysSinceLastOt, 10);
    reasons.push(`마지막 OT 이후 ${daysSinceLastOt}일 경과`);
  }

  return {
    employee,
    score,
    reasons,
    warnings
  };
}

function getCandidates(role) {
  return getEligibleEmployees().filter(employee => {
    if (role === "mri") return employee.canMri;
    return true;
  });
}

function getEmployeeOrder(employeeId) {
  const index = appData.employees.findIndex(employee => employee.id === employeeId);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function stableRandomValue(seedText) {
  let hash = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    hash ^= seedText.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function compareScoredCandidates(role, dateText) {
  return (a, b) => {
    const scoreDifference = a.score - b.score;
    if (scoreDifference !== 0) return scoreDifference;

    const aRandom = stableRandomValue(`${dateText}|${role}|${a.employee.id}`);
    const bRandom = stableRandomValue(`${dateText}|${role}|${b.employee.id}`);
    return aRandom - bRandom;
  };
}

function shouldSwapToSeniorMri(mriEmployeeId, xrayEmployeeId) {
  if (!mriEmployeeId || !xrayEmployeeId || mriEmployeeId === xrayEmployeeId) return false;

  const mriEmployee = appData.employees.find(employee => employee.id === mriEmployeeId);
  const xrayEmployee = appData.employees.find(employee => employee.id === xrayEmployeeId);
  if (!mriEmployee || !xrayEmployee) return false;

  const xrayEmployeeIsSenior = getEmployeeOrder(xrayEmployeeId) < getEmployeeOrder(mriEmployeeId);
  const swappedRolesAreValid = xrayEmployee.canMri;
  return xrayEmployeeIsSenior && swappedRolesAreValid;
}

function appendReasonOnce(element, text) {
  if (!element.textContent.includes(text)) {
    element.textContent = `${element.textContent} / ${text}`;
  }
}

function enforceSeniorMriAssignment(options = {}) {
  const mriEmployeeId = elements.manualMriSelect.value;
  const xrayEmployeeId = elements.manualXraySelect.value;

  if (!shouldSwapToSeniorMri(mriEmployeeId, xrayEmployeeId)) {
    return false;
  }

  elements.manualMriSelect.value = xrayEmployeeId;
  elements.manualXraySelect.value = mriEmployeeId;
  elements.mriRecommendationName.textContent = getEmployeeName(xrayEmployeeId);
  elements.xrayRecommendationName.textContent = getEmployeeName(mriEmployeeId);

  if (options.updateReason) {
    appendReasonOnce(elements.mriRecommendationReason, "선임 순서 기준으로 MRI 담당 배정");
    appendReasonOnce(elements.xrayRecommendationReason, "선임 순서 기준으로 X-ray 담당 배정");
  }

  return true;
}

function recommendForDate(dateText) {
  const monthKey = getMonthKey(dateText);
  const stats = buildEmployeeStats(monthKey);
  const warnings = [];

  const mriCandidates = getCandidates("mri");
  const xrayCandidates = getCandidates("xray");

  if (mriCandidates.length === 0) {
    return { error: "MRI 가능한 OT 대상 직원이 없습니다. 직원 관리에서 MRI 가능 직원을 등록해 주세요." };
  }

  if (xrayCandidates.length === 0) {
    return { error: "X-ray 담당으로 배정할 OT 대상 직원이 없습니다. 직원 관리에서 OT 대상 직원을 등록해 주세요." };
  }

  const allowPreviousOtForMri = mriCandidates.length <= 1;
  const mriScores = mriCandidates
    .map(employee => scoreCandidate(employee, "mri", dateText, stats, { allowPreviousOt: allowPreviousOtForMri }))
    .sort(compareScoredCandidates("mri", dateText));

  const selectedMri = mriScores[0];
  if (!selectedMri) {
    return { error: "MRI 담당자를 추천할 수 없습니다." };
  }

  if (allowPreviousOtForMri && wasAssignedOnPreviousOtDate(selectedMri.employee.id, dateText).assigned) {
    warnings.push("MRI 가능자가 부족하여 직전 조기출근일 근무자를 다시 추천했습니다.");
  }

  const remainingXrayCandidates = xrayCandidates.filter(employee => employee.id !== selectedMri.employee.id);
  const allowPreviousOtForXray = remainingXrayCandidates.length <= 1;
  const xrayScores = remainingXrayCandidates
    .map(employee => scoreCandidate(employee, "xray", dateText, stats, { allowPreviousOt: allowPreviousOtForXray }))
    .sort(compareScoredCandidates("xray", dateText));

  const selectedXray = xrayScores[0];
  if (!selectedXray) {
    return { error: "MRI 담당자와 다른 X-ray 담당자를 추천할 수 없습니다. OT 대상 직원을 추가해 주세요." };
  }

  warnings.push(...selectedMri.warnings, ...selectedXray.warnings);

  const fairness = calculateFairness(monthKey, [
    { mriEmployeeId: selectedMri.employee.id, xrayEmployeeId: selectedXray.employee.id, needsOt: true }
  ]);
  if (fairness.total.diff > appData.settings.maxMonthlyDifference) {
    warnings.push("현재 조건에서는 직원 간 OT 횟수 차이가 기준을 초과할 수 있습니다.");
  }

  return {
    date: dateText,
    mri: selectedMri,
    xray: selectedXray,
    warnings,
    fairness
  };
}

function recommendAlternate(role) {
  const dateText = elements.selectedDateInput.value;
  const monthKey = getMonthKey(dateText);
  const stats = buildEmployeeStats(monthKey);
  const currentRoleEmployeeId = role === "mri" ? elements.manualMriSelect.value : elements.manualXraySelect.value;
  const otherRoleEmployeeId = role === "mri" ? elements.manualXraySelect.value : elements.manualMriSelect.value;
  const candidates = getCandidates(role).filter(employee => {
    return employee.id !== currentRoleEmployeeId && employee.id !== otherRoleEmployeeId;
  });

  if (!candidates.length) {
    const roleName = role === "mri" ? "MRI" : "X-ray";
    showMessage(`${roleName} 차선 추천 후보가 없습니다. 현재 선택된 담당자와 반대 역할 담당자를 제외하면 가능한 직원이 없습니다.`, "error");
    return;
  }

  const allowPreviousOt = candidates.length <= 1;
  const scoredCandidates = candidates
    .map(employee => scoreCandidate(employee, role, dateText, stats, { allowPreviousOt }))
    .sort(compareScoredCandidates(role, dateText));
  const selected = scoredCandidates[0];
  const warnings = [...selected.warnings];

  if (allowPreviousOt && wasAssignedOnPreviousOtDate(selected.employee.id, dateText).assigned) {
    warnings.push("후보가 부족하여 직전 조기출근일 근무자를 차선으로 추천했습니다.");
  }

  if (role === "mri") {
    elements.manualMriSelect.value = selected.employee.id;
    elements.mriRecommendationName.textContent = selected.employee.name;
    elements.mriRecommendationReason.textContent = `차선 추천 사유: ${selected.reasons.join(", ")}`;
  } else {
    elements.manualXraySelect.value = selected.employee.id;
    elements.xrayRecommendationName.textContent = selected.employee.name;
    elements.xrayRecommendationReason.textContent = `차선 추천 사유: ${selected.reasons.join(", ")}`;
  }

  const swapped = enforceSeniorMriAssignment({ updateReason: true });
  setWarnings(warnings);
  renderFairness();
  showMessage(swapped ? "차선 추천 후 선임 순서 기준으로 MRI/X-ray 역할을 조정했습니다." : `${role === "mri" ? "MRI" : "X-ray"} 차선 담당자를 추천했습니다.`);
}

function calculateFairness(monthKey, extraRecords = []) {
  const stats = buildEmployeeStats(monthKey);

  extraRecords.forEach(record => {
    [record.mriEmployeeId, record.xrayEmployeeId].forEach(employeeId => {
      if (!employeeId || !stats.has(employeeId)) return;
      stats.get(employeeId).total += 1;
    });
    if (record.mriEmployeeId && stats.has(record.mriEmployeeId)) {
      stats.get(record.mriEmployeeId).mri += 1;
    }
    if (record.xrayEmployeeId && stats.has(record.xrayEmployeeId)) {
      stats.get(record.xrayEmployeeId).xray += 1;
    }
  });

  function roleDiff(role, employees) {
    const values = employees.map(employee => stats.get(employee.id)?.[role] || 0);
    if (!values.length) return { min: 0, max: 0, diff: 0, label: "대상 없음", className: "caution" };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const diff = max - min;
    return {
      min,
      max,
      diff,
      label: diff <= 1 ? "양호" : diff === 2 ? "주의" : "경고",
      className: diff <= 1 ? "good" : diff === 2 ? "caution" : "danger"
    };
  }

  const eligible = getEligibleEmployees();
  return {
    total: roleDiff("total", eligible)
  };
}

function renderRecommendation(result) {
  if (result.error) {
    currentRecommendation = null;
    showMessage(result.error, "error");
    return;
  }

  currentRecommendation = result;
  elements.mriRecommendationName.textContent = result.mri.employee.name;
  elements.mriRecommendationReason.textContent = `추천 사유: ${result.mri.reasons.join(", ")}`;
  elements.xrayRecommendationName.textContent = result.xray.employee.name;
  elements.xrayRecommendationReason.textContent = `추천 사유: ${result.xray.reasons.join(", ")}`;
  elements.manualMriSelect.value = result.mri.employee.id;
  elements.manualXraySelect.value = result.xray.employee.id;
  const swapped = enforceSeniorMriAssignment({ updateReason: true });
  setWarnings(result.warnings);
  renderFairness();
  showMessage(swapped ? `${result.date} 추천이 완료되었습니다. 선임 순서 기준으로 MRI/X-ray 역할을 조정했습니다.` : `${result.date} 추천이 완료되었습니다.`);
}

function renderEmployeeOptions() {
  const otEligibleEmployees = appData.employees.filter(employee => employee.isOtEligible);
  const nightEligibleEmployees = appData.employees.filter(employee => employee.isNightEligible);
  const otMriOptionHtml = otEligibleEmployees
    .filter(employee => employee.canMri)
    .map(employee => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
    .join("");
  const otOptionHtml = otEligibleEmployees
    .map(employee => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
    .join("");
  const nightMriOptionHtml = nightEligibleEmployees
    .filter(employee => employee.canMri)
    .map(employee => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
    .join("");
  const nightOptionHtml = nightEligibleEmployees
    .map(employee => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
    .join("");
  elements.manualMriSelect.innerHTML = `<option value="">선택 없음</option>${otMriOptionHtml}`;
  elements.manualXraySelect.innerHTML = `<option value="">선택 없음</option>${otOptionHtml}`;
  elements.nightMriSelect.innerHTML = `<option value="">선택 없음</option>${nightMriOptionHtml}`;
  elements.nightXraySelect.innerHTML = `<option value="">선택 없음</option>${nightOptionHtml}`;
}

function renderEmployees() {
  elements.employeeTableBody.innerHTML = appData.employees.map(employee => `
    <tr>
      <td>${escapeHtml(employee.name)}</td>
      <td>${employee.canMri ? "가능" : "-"}</td>
      <td>${employee.isOtEligible ? "대상" : "제외"}</td>
      <td>${employee.isNightEligible ? "대상" : "제외"}</td>
      <td>
        <button class="small-button" data-action="edit-employee" data-id="${employee.id}">수정</button>
        <button class="small-button" data-action="delete-employee" data-id="${employee.id}">삭제</button>
      </td>
    </tr>
  `).join("");
}

function renderRecords() {
  const records = [...appData.records].sort((a, b) => b.date.localeCompare(a.date));
  elements.recordTableBody.innerHTML = records.map(record => `
    <tr>
      <td>${record.date}</td>
      <td>${weekdayNames[getWeekday(record.date)]}</td>
      <td>${record.needsOt ? "예" : "없음"}</td>
      <td>${record.needsOt ? escapeHtml(getEmployeeName(record.mriEmployeeId)) : "-"}</td>
      <td>${record.needsOt ? escapeHtml(getEmployeeName(record.xrayEmployeeId)) : "-"}</td>
      <td>${record.nightMriEmployeeId ? escapeHtml(getEmployeeName(record.nightMriEmployeeId)) : "-"}</td>
      <td>${record.nightXrayEmployeeId ? escapeHtml(getEmployeeName(record.nightXrayEmployeeId)) : "-"}</td>
      <td>${escapeHtml(record.memo || "")}</td>
      <td>
        <button class="small-button" data-action="edit-record" data-date="${record.date}">수정</button>
        <button class="small-button" data-action="delete-record" data-date="${record.date}">삭제</button>
      </td>
    </tr>
  `).join("");
}

function renderMonthlySummary() {
  const monthKey = getMonthKey(elements.selectedDateInput.value);
  const stats = buildEmployeeStats(monthKey);
  const rows = [...stats.values()]
    .filter(item => item.employee.isOtEligible || item.total > 0)
    .sort((a, b) => b.total - a.total || a.employee.name.localeCompare(b.employee.name, "ko"));

  elements.monthlySummaryBody.innerHTML = rows.map(item => `
    <tr>
      <td>${escapeHtml(item.employee.name)}</td>
      <td>${item.total}</td>
      <td>${item.mri}</td>
      <td>${item.xray}</td>
    </tr>
  `).join("");
}

function renderFairness() {
  const monthKey = getMonthKey(elements.selectedDateInput.value);
  const fairness = calculateFairness(monthKey);
  elements.fairnessStatus.innerHTML = `
    <div>전체 OT 공정성: <span class="status-label ${fairness.total.className}">${fairness.total.label}</span> 최대 차이 ${fairness.total.diff}회</div>
  `;
}

function renderCalendar() {
  const selectedDate = elements.selectedDateInput.value;
  const [year, month] = selectedDate.split("-").map(Number);
  const firstDate = new Date(year, month - 1, 1);
  const lastDate = new Date(year, month, 0);
  const firstWeekday = firstDate.getDay();
  const todayText = getTodayText();
  const recordDates = new Set(appData.records.map(record => record.date));

  elements.calendarMonthLabel.textContent = `${year}년 ${month}월`;
  elements.selectedDateDisplay.value = formatKoreanDate(selectedDate);

  const cells = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push('<button class="calendar-day is-empty" type="button" tabindex="-1"></button>');
  }

  for (let day = 1; day <= lastDate.getDate(); day += 1) {
    const dateText = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const weekday = getWeekday(dateText);
    const classes = ["calendar-day"];
    if (dateText === selectedDate) classes.push("is-selected");
    if (dateText === todayText) classes.push("is-today");
    if (recordDates.has(dateText)) classes.push("has-record");
    if (weekday === 0) classes.push("is-sunday");
    if (weekday === 6) classes.push("is-saturday");

    const record = appData.records.find(item => item.date === dateText);
    const otText = record?.needsOt
      ? `OT: ${getGivenNameOnly(record.mriEmployeeId)}/${getGivenNameOnly(record.xrayEmployeeId)}`
      : "";
    const nightText = record?.nightMriEmployeeId || record?.nightXrayEmployeeId
      ? `야간: ${getGivenNameOnly(record.nightMriEmployeeId)}/${getGivenNameOnly(record.nightXrayEmployeeId)}`
      : "";
    cells.push(`
      <button class="${classes.join(" ")}" type="button" data-date="${dateText}">
        <span class="calendar-day-number">${day}</span>
        <span class="calendar-day-info">
          <span class="${otText ? "calendar-day-note" : "calendar-day-note-empty"}">${escapeHtml(otText || "-")}</span>
          <span aria-hidden="true"></span>
          <span class="${nightText ? "calendar-day-note calendar-day-note-night" : "calendar-day-note-empty calendar-day-note-night"}">${escapeHtml(nightText || "-")}</span>
        </span>
      </button>
    `);
  }

  elements.calendarGrid.innerHTML = cells.join("");
}

function renderAll() {
  elements.selectedWeekday.textContent = weekdayNames[getWeekday(elements.selectedDateInput.value)];
  renderCalendar();
  renderEmployeeOptions();
  renderEmployees();
  renderRecords();
  renderMonthlySummary();
  renderFairness();
}

function resetEmployeeForm() {
  elements.employeeIdInput.value = "";
  elements.employeeNameInput.value = "";
  elements.employeeCanMriInput.checked = false;
  elements.employeeEligibleInput.checked = true;
  elements.employeeNightEligibleInput.checked = true;
}

function resetRecommendationView() {
  currentRecommendation = null;
  elements.mriRecommendationName.textContent = "추천 전";
  elements.mriRecommendationReason.textContent = "추천 버튼을 누르면 사유가 표시됩니다.";
  elements.xrayRecommendationName.textContent = "추천 전";
  elements.xrayRecommendationReason.textContent = "추천 버튼을 누르면 사유가 표시됩니다.";
  elements.manualMriSelect.value = "";
  elements.manualXraySelect.value = "";
  elements.nightMriSelect.value = "";
  elements.nightXraySelect.value = "";
  elements.recordMemoInput.value = "";
  setWarnings([]);
  hideMessage();
}

function setInputSectionVisibility(sectionName) {
  elements.otInputSection.classList.toggle("hidden", sectionName !== "ot");
  elements.nightInputSection.classList.toggle("hidden", sectionName !== "night");
  elements.showOtInputButton.classList.toggle("is-active-mode", sectionName === "ot");
  elements.showNightInputButton.classList.toggle("is-active-mode", sectionName === "night");
}

function loadSelectedRecordIntoForm() {
  const record = appData.records.find(item => item.date === elements.selectedDateInput.value);

  elements.manualMriSelect.value = record?.mriEmployeeId || "";
  elements.manualXraySelect.value = record?.xrayEmployeeId || "";
  elements.nightMriSelect.value = record?.nightMriEmployeeId || "";
  elements.nightXraySelect.value = record?.nightXrayEmployeeId || "";
  elements.recordMemoInput.value = record?.memo || "";

  if (record?.needsOt) {
    elements.mriRecommendationName.textContent = getEmployeeName(record.mriEmployeeId);
    elements.xrayRecommendationName.textContent = getEmployeeName(record.xrayEmployeeId);
    elements.mriRecommendationReason.textContent = "기존 조출 기록을 불러왔습니다.";
    elements.xrayRecommendationReason.textContent = "기존 조출 기록을 불러왔습니다.";
  } else {
    elements.mriRecommendationName.textContent = "추천 전";
    elements.xrayRecommendationName.textContent = "추천 전";
    elements.mriRecommendationReason.textContent = "추천 버튼을 누르면 사유가 표시됩니다.";
    elements.xrayRecommendationReason.textContent = "추천 버튼을 누르면 사유가 표시됩니다.";
  }

  currentRecommendation = null;
  setWarnings([]);
}

async function saveRecord() {
  const date = elements.selectedDateInput.value;
  enforceSeniorMriAssignment({ updateReason: true });
  const mriEmployeeId = elements.manualMriSelect.value;
  const xrayEmployeeId = elements.manualXraySelect.value;
  const nightMriEmployeeId = elements.nightMriSelect.value;
  const nightXrayEmployeeId = elements.nightXraySelect.value;
  const hasOtInput = Boolean(mriEmployeeId || xrayEmployeeId);
  const needsOt = Boolean(mriEmployeeId && xrayEmployeeId);
  const hasNightInput = Boolean(nightMriEmployeeId || nightXrayEmployeeId);

  if (hasOtInput) {
    if (!mriEmployeeId || !xrayEmployeeId) {
      showMessage("조기출근 MRI 담당자와 X-ray 담당자는 둘 다 선택하거나 둘 다 비워 주세요.", "error");
      return;
    }
    if (mriEmployeeId === xrayEmployeeId) {
      showMessage("MRI 담당자와 X-ray 담당자는 같은 사람이 될 수 없습니다.", "error");
      return;
    }
    const mriEmployee = appData.employees.find(employee => employee.id === mriEmployeeId);
    if (!mriEmployee?.canMri) {
      showMessage("MRI 담당자는 MRI 가능 직원이어야 합니다.", "error");
      return;
    }
  }

  if (hasNightInput) {
    if (!nightMriEmployeeId || !nightXrayEmployeeId) {
      showMessage("야간 MRI 담당자와 야간 X-ray 담당자를 모두 선택해 주세요.", "error");
      return;
    }
    if (nightMriEmployeeId === nightXrayEmployeeId) {
      showMessage("야간 MRI 담당자와 야간 X-ray 담당자는 같은 사람이 될 수 없습니다.", "error");
      return;
    }
    const nightMriEmployee = appData.employees.find(employee => employee.id === nightMriEmployeeId);
    if (!nightMriEmployee?.canMri) {
      showMessage("야간 MRI 담당자는 MRI 가능 직원이어야 합니다.", "error");
      return;
    }
    if (!nightMriEmployee?.isNightEligible) {
      showMessage("야간 MRI 담당자는 야간 대상 직원이어야 합니다.", "error");
      return;
    }
    const nightXrayEmployee = appData.employees.find(employee => employee.id === nightXrayEmployeeId);
    if (!nightXrayEmployee?.isNightEligible) {
      showMessage("야간 X-ray 담당자는 야간 대상 직원이어야 합니다.", "error");
      return;
    }
  }

  const confirmText = needsOt || hasNightInput
    ? `${date} 기록을 확정할까요?`
    : `${date}에 조기출근/야간근무가 없는 것으로 저장할까요?`;
  if (!window.confirm(confirmText)) return;

  appData.records = appData.records.filter(record => record.date !== date);
  appData.records.push({
    date,
    needsOt,
    mriEmployeeId: needsOt ? mriEmployeeId : "",
    xrayEmployeeId: needsOt ? xrayEmployeeId : "",
    nightMriEmployeeId,
    nightXrayEmployeeId,
    memo: elements.recordMemoInput.value.trim()
  });

  await saveData();
  renderAll();
  loadSelectedRecordIntoForm();
  showMessage("기록이 저장되었습니다.");
}

function editEmployee(employeeId) {
  const employee = appData.employees.find(item => item.id === employeeId);
  if (!employee) return;
  elements.employeeIdInput.value = employee.id;
  elements.employeeNameInput.value = employee.name;
  elements.employeeCanMriInput.checked = employee.canMri;
  elements.employeeEligibleInput.checked = employee.isOtEligible;
  elements.employeeNightEligibleInput.checked = employee.isNightEligible;
}

async function deleteEmployee(employeeId) {
  const employee = appData.employees.find(item => item.id === employeeId);
  if (!employee) return;
  if (!window.confirm(`${employee.name} 직원을 삭제할까요? 기존 기록은 이름 대신 '-'로 보일 수 있습니다.`)) return;
  appData.employees = appData.employees.filter(item => item.id !== employeeId);
  await saveData();
  renderAll();
  showMessage("직원이 삭제되었습니다.");
}

function editRecord(dateText) {
  const record = appData.records.find(item => item.date === dateText);
  if (!record) return;
  elements.selectedDateInput.value = record.date;
  renderAll();
  elements.manualMriSelect.value = record.mriEmployeeId || "";
  elements.manualXraySelect.value = record.xrayEmployeeId || "";
  elements.nightMriSelect.value = record.nightMriEmployeeId || "";
  elements.nightXraySelect.value = record.nightXrayEmployeeId || "";
  elements.recordMemoInput.value = record.memo || "";
  elements.mriRecommendationName.textContent = record.needsOt ? getEmployeeName(record.mriEmployeeId) : "조기출근 없음";
  elements.xrayRecommendationName.textContent = record.needsOt ? getEmployeeName(record.xrayEmployeeId) : "조기출근 없음";
  elements.mriRecommendationReason.textContent = "기존 기록을 수정 중입니다.";
  elements.xrayRecommendationReason.textContent = "기존 기록을 수정 중입니다.";
}

async function deleteRecord(dateText) {
  if (!window.confirm(`${dateText} 기록을 삭제할까요?`)) return;
  appData.records = appData.records.filter(record => record.date !== dateText);
  await saveData();
  renderAll();
  showMessage("기록이 삭제되었습니다.");
}

function exportCsv() {
  const header = ["날짜", "요일", "조기출근 여부", "MRI 담당", "X-ray 담당", "야간 MRI", "야간 X-ray", "메모"];
  const rows = appData.records
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(record => [
      record.date,
      weekdayNames[getWeekday(record.date)],
      record.needsOt ? "예" : "없음",
      record.needsOt ? getEmployeeName(record.mriEmployeeId) : "",
      record.needsOt ? getEmployeeName(record.xrayEmployeeId) : "",
      record.nightMriEmployeeId ? getEmployeeName(record.nightMriEmployeeId) : "",
      record.nightXrayEmployeeId ? getEmployeeName(record.nightXrayEmployeeId) : "",
      record.memo || ""
    ]);

  const csv = [header, ...rows]
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `조기출근_OT_기록_${getTodayText()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadTextFile(fileName, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function backupJson() {
  const json = JSON.stringify(appData, null, 2);
  downloadTextFile(`조기출근_OT_백업_${getTodayText()}.json`, json, "application/json;charset=utf-8");
}

function restoreJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsedData = JSON.parse(reader.result);
      validateImportedData(parsedData);
      const restoredData = normalizeData(parsedData);

      if (!window.confirm("현재 브라우저에 저장된 데이터를 백업 파일 내용으로 교체할까요?")) {
        return;
      }

      appData = restoredData;
      saveData();
      renderAll();
      loadSelectedRecordIntoForm();
      showMessage("백업 파일을 복원했습니다.");
    } catch (error) {
      showMessage(error.message || "백업 파일을 읽지 못했습니다.", "error");
    }
  };
  reader.readAsText(file, "utf-8");
}

elements.selectedDateInput.addEventListener("change", () => {
  renderAll();
  loadSelectedRecordIntoForm();
});

elements.previousMonthButton.addEventListener("click", () => {
  const date = parseLocalDate(elements.selectedDateInput.value);
  date.setMonth(date.getMonth() - 1);
  elements.selectedDateInput.value = formatLocalDate(date);
  renderAll();
  loadSelectedRecordIntoForm();
});

elements.nextMonthButton.addEventListener("click", () => {
  const date = parseLocalDate(elements.selectedDateInput.value);
  date.setMonth(date.getMonth() + 1);
  elements.selectedDateInput.value = formatLocalDate(date);
  renderAll();
  loadSelectedRecordIntoForm();
});

elements.calendarGrid.addEventListener("click", event => {
  const button = event.target.closest("button[data-date]");
  if (!button) return;
  elements.selectedDateInput.value = button.dataset.date;
  renderAll();
  loadSelectedRecordIntoForm();
});

elements.showOtInputButton.addEventListener("click", () => {
  setInputSectionVisibility("ot");
  loadSelectedRecordIntoForm();
});

elements.showNightInputButton.addEventListener("click", () => {
  setInputSectionVisibility("night");
  loadSelectedRecordIntoForm();
});

elements.recommendButton.addEventListener("click", () => {
  setInputSectionVisibility("ot");
  renderRecommendation(recommendForDate(elements.selectedDateInput.value));
});

elements.tomorrowPreviewButton.addEventListener("click", () => {
  elements.selectedDateInput.value = addDays(getTodayText(), 1);
  renderAll();
  setInputSectionVisibility("ot");
  renderRecommendation(recommendForDate(elements.selectedDateInput.value));
});

elements.algorithmHelpButton.addEventListener("click", () => {
  elements.algorithmHelpDialog.showModal();
});

elements.algorithmHelpCloseButton.addEventListener("click", () => {
  elements.algorithmHelpDialog.close();
});

elements.confirmRecordButton.addEventListener("click", saveRecord);
elements.resetFormButton.addEventListener("click", resetRecommendationView);
elements.exportCsvButton.addEventListener("click", exportCsv);
elements.alternateMriButton.addEventListener("click", () => recommendAlternate("mri"));
elements.alternateXrayButton.addEventListener("click", () => recommendAlternate("xray"));
elements.manualMriSelect.addEventListener("change", () => {
  if (enforceSeniorMriAssignment({ updateReason: true })) {
    showMessage("선임 순서 기준으로 MRI/X-ray 역할을 조정했습니다.");
  }
});
elements.manualXraySelect.addEventListener("change", () => {
  if (enforceSeniorMriAssignment({ updateReason: true })) {
    showMessage("선임 순서 기준으로 MRI/X-ray 역할을 조정했습니다.");
  }
});
elements.backupJsonButton.addEventListener("click", backupJson);
elements.restoreJsonButton.addEventListener("click", () => elements.restoreJsonInput.click());
elements.restoreJsonInput.addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) restoreJson(file);
  event.target.value = "";
});

elements.employeeForm.addEventListener("submit", async event => {
  event.preventDefault();
  const name = elements.employeeNameInput.value.trim();
  if (!name) {
    showMessage("직원 이름을 입력해 주세요.", "error");
    return;
  }

  const id = elements.employeeIdInput.value || `emp_${Date.now()}`;
  const employee = {
    id,
    name,
    canMri: elements.employeeCanMriInput.checked,
    isOtEligible: elements.employeeEligibleInput.checked,
    isNightEligible: elements.employeeNightEligibleInput.checked
  };

  const existingIndex = appData.employees.findIndex(item => item.id === id);
  if (existingIndex >= 0) {
    appData.employees[existingIndex] = employee;
  } else {
    appData.employees.push(employee);
  }

  await saveData();
  resetEmployeeForm();
  renderAll();
  loadSelectedRecordIntoForm();
  showMessage("직원 정보가 저장되었습니다.");
});

elements.cancelEmployeeEditButton.addEventListener("click", resetEmployeeForm);

elements.employeeTableBody.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "edit-employee") editEmployee(button.dataset.id);
  if (button.dataset.action === "delete-employee") deleteEmployee(button.dataset.id);
});

elements.recordTableBody.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "edit-record") editRecord(button.dataset.date);
  if (button.dataset.action === "delete-record") deleteRecord(button.dataset.date);
});

async function initialize() {
  try {
    elements.selectedDateInput.value = getTodayText();
    await loadData();
    renderAll();
    loadSelectedRecordIntoForm();
    showMessage("샘플 데이터가 준비되어 있습니다. 실제 직원명으로 수정해 사용하세요.");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

initialize();
