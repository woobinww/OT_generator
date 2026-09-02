const weekdayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
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
    isNightEligible: true,
    mriStartDate: "",
    otStartDate: "",
    nightStartDate: "",
    hireDate: "",
    retireDate: ""
  },
  {
    id: "emp_sample_002",
    name: "이서연",
    canMri: true,
    isOtEligible: true,
    isNightEligible: true,
    mriStartDate: "",
    otStartDate: "",
    nightStartDate: "",
    hireDate: "",
    retireDate: ""
  },
  {
    id: "emp_sample_003",
    name: "박지훈",
    canMri: false,
    isOtEligible: true,
    isNightEligible: true,
    mriStartDate: "",
    otStartDate: "",
    nightStartDate: "",
    hireDate: "",
    retireDate: ""
  },
  {
    id: "emp_sample_004",
    name: "최유진",
    canMri: false,
    isOtEligible: true,
    isNightEligible: true,
    mriStartDate: "",
    otStartDate: "",
    nightStartDate: "",
    hireDate: "",
    retireDate: ""
  }
];

let appData = {
  employees: [],
  records: [],
  attendanceRecords: [],
  exceptions: [],
  settings: {}
};

let currentRecommendation = null;
let calendarTooltipElement = null;
let serverViewMode = false;
let serverAutoSyncEnabled = false;
let serverAutoSyncTimer = null;
let serverSyncVersion = null;
let adminEmployeeId = "";
let adminOnlyMyAttendance = false;
const selectedAnnualLeaveDates = new Set();

const elements = {
  adminLoginScreen: document.querySelector("#adminLoginScreen"),
  adminAppShell: document.querySelector("#adminAppShell"),
  adminGateUsernameInput: document.querySelector("#adminGateUsernameInput"),
  adminGatePasswordInput: document.querySelector("#adminGatePasswordInput"),
  adminGateLoginButton: document.querySelector("#adminGateLoginButton"),
  adminGateMessage: document.querySelector("#adminGateMessage"),
  selectedDateInput: document.querySelector("#selectedDateInput"),
  selectedDateDisplay: document.querySelector("#selectedDateDisplay"),
  selectedWeekday: document.querySelector("#selectedWeekday"),
  previousMonthButton: document.querySelector("#previousMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  calendarMonthLabel: document.querySelector("#calendarMonthLabel"),
  adminMyAttendanceToggleButton: document.querySelector("#adminMyAttendanceToggleButton"),
  calendarGrid: document.querySelector("#calendarGrid"),
  showOtInputButton: document.querySelector("#showOtInputButton"),
  showNightInputButton: document.querySelector("#showNightInputButton"),
  showAttendanceInputButton: document.querySelector("#showAttendanceInputButton"),
  otInputSection: document.querySelector("#otInputSection"),
  nightInputSection: document.querySelector("#nightInputSection"),
  attendanceInputSection: document.querySelector("#attendanceInputSection"),
  recommendButton: document.querySelector("#recommendButton"),
  algorithmHelpButton: document.querySelector("#algorithmHelpButton"),
  algorithmHelpDialog: document.querySelector("#algorithmHelpDialog"),
  algorithmHelpCloseButton: document.querySelector("#algorithmHelpCloseButton"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  exportAttendanceCsvButton: document.querySelector("#exportAttendanceCsvButton"),
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
  manualMriOtInput: document.querySelector("#manualMriOtInput"),
  manualXrayOtInput: document.querySelector("#manualXrayOtInput"),
  nightMriSelect: document.querySelector("#nightMriSelect"),
  nightXraySelect: document.querySelector("#nightXraySelect"),
  nightMriOtInput: document.querySelector("#nightMriOtInput"),
  nightXrayOtInput: document.querySelector("#nightXrayOtInput"),
  recordMemoInput: document.querySelector("#recordMemoInput"),
  attendanceNameSelect: document.querySelector("#attendanceNameSelect"),
  attendanceOtInput: document.querySelector("#attendanceOtInput"),
  attendanceOtUsedInput: document.querySelector("#attendanceOtUsedInput"),
  attendanceNightOtInput: document.querySelector("#attendanceNightOtInput"),
  attendanceHolidayOtInput: document.querySelector("#attendanceHolidayOtInput"),
  attendanceFlexEarnedInput: document.querySelector("#attendanceFlexEarnedInput"),
  attendanceFlexUsedInput: document.querySelector("#attendanceFlexUsedInput"),
  attendanceFlexReasonInput: document.querySelector("#attendanceFlexReasonInput"),
  attendanceOffSelect: document.querySelector("#attendanceOffSelect"),
  annualLeaveBox: document.querySelector("#annualLeaveBox"),
  annualLeaveSelectionSummary: document.querySelector("#annualLeaveSelectionSummary"),
  saveAnnualLeaveButton: document.querySelector("#saveAnnualLeaveButton"),
  attendanceManualNoteInput: document.querySelector("#attendanceManualNoteInput"),
  attendanceAutoNoteInput: document.querySelector("#attendanceAutoNoteInput"),
  saturdayOffBox: document.querySelector(".saturday-off-box"),
  saturdayOffList: document.querySelector("#saturdayOffList"),
  saveSaturdayOffButton: document.querySelector("#saveSaturdayOffButton"),
  saveAttendanceButton: document.querySelector("#saveAttendanceButton"),
  resetAttendanceButton: document.querySelector("#resetAttendanceButton"),
  confirmRecordButton: document.querySelector("#confirmRecordButton"),
  resetFormButton: document.querySelector("#resetFormButton"),
  fairnessStatus: document.querySelector("#fairnessStatus"),
  monthlySummaryBody: document.querySelector("#monthlySummaryBody"),
  employeeForm: document.querySelector("#employeeForm"),
  employeeIdInput: document.querySelector("#employeeIdInput"),
  employeeNameInput: document.querySelector("#employeeNameInput"),
  employeeHireDateInput: document.querySelector("#employeeHireDateInput"),
  employeeRetireDateInput: document.querySelector("#employeeRetireDateInput"),
  employeeMriStartDateInput: document.querySelector("#employeeMriStartDateInput"),
  employeeOtStartDateInput: document.querySelector("#employeeOtStartDateInput"),
  employeeNightStartDateInput: document.querySelector("#employeeNightStartDateInput"),
  showEmployeeFormButton: document.querySelector("#showEmployeeFormButton"),
  cancelEmployeeEditButton: document.querySelector("#cancelEmployeeEditButton"),
  employeeTableBody: document.querySelector("#employeeTableBody"),
  recordTableBody: document.querySelector("#recordTableBody"),
  attendanceTableBody: document.querySelector("#attendanceTableBody"),
  serverStatusBox: document.querySelector("#serverStatusBox"),
  serverReloadButton: document.querySelector("#serverReloadButton"),
  serverLogoutButton: document.querySelector("#serverLogoutButton"),
  serverImportFileInput: document.querySelector("#serverImportFileInput"),
  serverImportButton: document.querySelector("#serverImportButton"),
  serverSummaryBody: document.querySelector("#serverSummaryBody"),
  serverUsersRefreshButton: document.querySelector("#serverUsersRefreshButton"),
  serverUserEmployeeSelect: document.querySelector("#serverUserEmployeeSelect"),
  serverNewUserRoleSelect: document.querySelector("#serverNewUserRoleSelect"),
  serverNewUsernameInput: document.querySelector("#serverNewUsernameInput"),
  serverNewPasswordInput: document.querySelector("#serverNewPasswordInput"),
  serverCreateUserToggleButton: document.querySelector("#serverCreateUserToggleButton"),
  serverCreateUserForm: document.querySelector("#serverCreateUserForm"),
  serverCreateUserCancelButton: document.querySelector("#serverCreateUserCancelButton"),
  serverCreateUserButton: document.querySelector("#serverCreateUserButton"),
  serverPasswordUserSelect: document.querySelector("#serverPasswordUserSelect"),
  serverChangePasswordInput: document.querySelector("#serverChangePasswordInput"),
  serverChangePasswordToggleButton: document.querySelector("#serverChangePasswordToggleButton"),
  serverChangePasswordForm: document.querySelector("#serverChangePasswordForm"),
  serverChangePasswordCancelButton: document.querySelector("#serverChangePasswordCancelButton"),
  serverChangePasswordButton: document.querySelector("#serverChangePasswordButton"),
  serverUsersBody: document.querySelector("#serverUsersBody")
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

function getGivenNameOnlyByName(name) {
  const fullName = String(name || "").trim();
  if (!fullName) return "-";
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
    employees: sampleEmployees.map(normalizeEmployee),
    records: [],
    attendanceRecords: [],
    exceptions: [],
    settings: defaultSettings
  };
}

function normalizeData(data) {
  return {
    employees: Array.isArray(data.employees) ? data.employees.map(normalizeEmployee) : [],
    records: Array.isArray(data.records) ? data.records.map(normalizeRecord) : [],
    attendanceRecords: Array.isArray(data.attendanceRecords) ? data.attendanceRecords.map(normalizeAttendanceRecord) : [],
    exceptions: Array.isArray(data.exceptions) ? data.exceptions : [],
    settings: { ...defaultSettings, ...(data.settings || {}) }
  };
}

function normalizeEmployee(employee) {
  const legacyImmediateDate = employee.hireDate || "1900-01-01";
  const mriStartDate = employee.mriStartDate || (employee.canMri ? legacyImmediateDate : "");
  const otStartDate = employee.otStartDate || (employee.isOtEligible !== false ? legacyImmediateDate : "");
  const nightStartDate = employee.nightStartDate || (employee.isNightEligible !== false ? legacyImmediateDate : "");

  return {
    id: employee.id || `emp_${Date.now()}`,
    name: employee.name || "",
    canMri: Boolean(mriStartDate),
    isOtEligible: Boolean(otStartDate),
    isNightEligible: Boolean(nightStartDate),
    mriStartDate,
    otStartDate,
    nightStartDate,
    hireDate: employee.hireDate || "",
    retireDate: employee.retireDate || ""
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

function toNumberOrZero(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : "";
}

function normalizeOtUsedValue(value) {
  const optionalNumber = toOptionalNumber(value);
  if (optionalNumber === "") return 0;
  return -Math.abs(optionalNumber);
}

function formatNumberForNote(value) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function normalizeUsedValue(value) {
  const optionalNumber = toOptionalNumber(value);
  if (optionalNumber === "") return 0;
  return -Math.abs(optionalNumber);
}

function buildAttendanceAutoNote(otEarned, otUsed, flexEarned = "", flexUsed = "", flexReason = "") {
  const earnedValue = toNumberOrZero(otEarned);
  const usedValue = normalizeUsedValue(otUsed);
  const flexEarnedValue = toNumberOrZero(flexEarned);
  const flexUsedValue = normalizeUsedValue(flexUsed);
  const cleanFlexReason = String(flexReason || "").trim();
  const parts = [];

  if (earnedValue !== 0 && usedValue !== 0) {
    parts.push(`OT(${formatNumberForNote(earnedValue)})`);
  }

  if (usedValue !== 0) {
    const absoluteUsedValue = Math.abs(usedValue);
    if (absoluteUsedValue === 4) {
      parts.push(`OT사용 반차(${formatNumberForNote(usedValue)})`);
    } else if (absoluteUsedValue === 8) {
      parts.push(`OT사용 off(${formatNumberForNote(usedValue)})`);
    } else {
      parts.push(`OT사용(${formatNumberForNote(usedValue)})`);
    }
  }

  if (flexEarnedValue !== 0) {
    parts.push(`탄력 ${cleanFlexReason}(${formatNumberForNote(flexEarnedValue)})`);
  }

  if (flexUsedValue !== 0) {
    parts.push(`탄력사용(${formatNumberForNote(flexUsedValue)})`);
  }

  return parts.join(" + ");
}

function buildAttendanceFinalNote(manualNote, autoNote) {
  return [String(manualNote || "").trim(), String(autoNote || "").trim()].filter(Boolean).join(" + ");
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

function syncAttendanceNoteWithOtInputs() {
  const autoNote = buildAttendanceAutoNote(
    elements.attendanceOtInput.value,
    elements.attendanceOtUsedInput.value,
    elements.attendanceFlexEarnedInput.value,
    elements.attendanceFlexUsedInput.value,
    elements.attendanceFlexReasonInput.value
  );
  elements.attendanceAutoNoteInput.value = buildAttendanceFinalNote(elements.attendanceManualNoteInput.value, autoNote);
}

function getOtParts(record) {
  const legacyOt = toNumberOrZero(record.ot);
  const legacyDisplayOt = toOptionalNumber(record.displayOt);
  const hasStoredParts = record.otEarned !== undefined || record.otUsed !== undefined;

  if (hasStoredParts) {
    return {
      otEarned: toNumberOrZero(record.otEarned),
      otUsed: normalizeOtUsedValue(record.otUsed)
    };
  }

  if (legacyDisplayOt !== "") {
    const normalizedLegacyDisplayOt = normalizeOtUsedValue(legacyDisplayOt);
    return {
      otEarned: legacyOt - normalizedLegacyDisplayOt,
      otUsed: normalizedLegacyDisplayOt
    };
  }

  return {
    otEarned: legacyOt > 0 ? legacyOt : 0,
    otUsed: legacyOt < 0 ? legacyOt : 0
  };
}

function getFlexParts(record) {
  const legacyFlexOt = toNumberOrZero(record.flexOt);
  const hasStoredParts = record.flexEarned !== undefined || record.flexUsed !== undefined;
  const storedFlexEarned = toNumberOrZero(record.flexEarned);
  const storedFlexUsed = normalizeUsedValue(record.flexUsed);

  if (hasStoredParts && (storedFlexEarned !== 0 || storedFlexUsed !== 0 || legacyFlexOt === 0)) {
    return {
      flexEarned: storedFlexEarned,
      flexUsed: storedFlexUsed
    };
  }

  return {
    flexEarned: legacyFlexOt > 0 ? legacyFlexOt : 0,
    flexUsed: legacyFlexOt < 0 ? legacyFlexOt : 0
  };
}

function normalizeAttendanceRecord(record) {
  const otParts = getOtParts(record);
  const otTotal = otParts.otEarned + otParts.otUsed;
  const flexParts = getFlexParts(record);
  const flexOt = flexParts.flexEarned + flexParts.flexUsed;
  const flexReason = String(record.flexReason || "").trim();
  const autoNote = buildAttendanceAutoNote(
    otParts.otEarned,
    otParts.otUsed,
    flexParts.flexEarned,
    flexParts.flexUsed,
    flexReason
  );
  const manualNote = record.manualNote !== undefined && String(record.manualNote || "").trim()
    ? String(record.manualNote || "").trim()
    : stripAutoOtNotePrefix(record.note || "");

  return {
    date: record.date || "",
    name: record.name || "",
    ot: otTotal,
    otEarned: otParts.otEarned,
    otUsed: otParts.otUsed,
    nightOt: toNumberOrZero(record.nightOt),
    holidayOt: toNumberOrZero(record.holidayOt),
    flexOt,
    flexEarned: flexParts.flexEarned,
    flexUsed: flexParts.flexUsed,
    flexReason,
    off: record.off || "",
    manualNote,
    autoNote,
    note: buildAttendanceFinalNote(manualNote, autoNote)
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
  appData = createInitialData();
}

function saveData(options = {}) {
  if (options.syncServer !== false) {
    scheduleServerAutoSync();
  }
}

function scheduleServerAutoSync() {
  if (!serverAutoSyncEnabled) return;
  clearTimeout(serverAutoSyncTimer);
  serverAutoSyncTimer = setTimeout(() => {
    syncLocalDataToServer().catch(error => {
      console.error(error);
      if (error.status === 409) {
        serverAutoSyncEnabled = false;
        setServerRecoveryButtonVisible(true);
        setServerStatus(error.message || "서버 동기화 충돌이 발생했습니다. 서버에서 다시 불러온 뒤 저장해 주세요.", "error");
        return;
      }
      setServerStatus(error.message || "저장은 되었지만 서버 자동 동기화에 실패했습니다.", "error");
    });
  }, 300);
}

async function syncLocalDataToServer() {
  if (!serverAutoSyncEnabled) return;
  const payload = await serverRequest("/api/admin/import-local-data?replace=true", {
    method: "POST",
    body: JSON.stringify({ data: appData, baseVersion: serverSyncVersion })
  });
  serverSyncVersion = payload.summary?.version ?? serverSyncVersion;
  await loadServerMonthlySummary();
}

function isEmployeeActiveOnDate(employee, dateText) {
  if (!employee) return false;
  if (!dateText) return true;
  if (employee.hireDate && employee.hireDate > dateText) return false;
  if (employee.retireDate && employee.retireDate <= dateText) return false;
  return true;
}

function getActiveEmployees(dateText) {
  return appData.employees.filter(employee => isEmployeeActiveOnDate(employee, dateText));
}

function isCapabilityAvailableOnDate(employee, capabilityStartDate, dateText) {
  if (!employee || !isEmployeeActiveOnDate(employee, dateText)) return false;
  if (!capabilityStartDate) return true;
  return capabilityStartDate <= dateText;
}

function canEmployeeDoMriOnDate(employee, dateText) {
  return Boolean(employee?.mriStartDate) && isCapabilityAvailableOnDate(employee, employee.mriStartDate, dateText);
}

function isEmployeeOtEligibleOnDate(employee, dateText) {
  return Boolean(employee?.otStartDate) && isCapabilityAvailableOnDate(employee, employee.otStartDate, dateText);
}

function isEmployeeNightEligibleOnDate(employee, dateText) {
  return Boolean(employee?.nightStartDate) && isCapabilityAvailableOnDate(employee, employee.nightStartDate, dateText);
}

function getEligibleEmployees(dateText) {
  return getActiveEmployees(dateText).filter(employee => isEmployeeOtEligibleOnDate(employee, dateText));
}

function getAttendanceRecordForEmployee(dateText, employee) {
  return appData.attendanceRecords.find(record => record.date === dateText && record.name === employee.name);
}

function isEmployeeExcludedFromOtRecommendation(employee, dateText) {
  const attendanceRecord = getAttendanceRecordForEmployee(dateText, employee);
  if (!attendanceRecord) return false;

  if (["연차", "오전반차", "토요일OFF"].includes(attendanceRecord.off)) {
    return true;
  }

  return Number(attendanceRecord.otUsed || 0) <= -8;
}

function isEmployeeRelevantForMonth(employee, monthKey) {
  const monthStart = `${monthKey}-01`;
  const monthEnd = formatLocalDate(new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0));

  if (!employee.otStartDate) return false;
  if (employee.otStartDate > monthEnd) return false;
  if (employee.hireDate && employee.hireDate > monthEnd) return false;
  if (employee.retireDate && employee.retireDate <= monthStart) return false;
  return true;
}

function getMonthlyFairnessEmployees(monthKey, stats) {
  return appData.employees.filter(employee => {
    const employeeStats = stats.get(employee.id);
    return isEmployeeRelevantForMonth(employee, monthKey) || (employeeStats?.total || 0) > 0;
  });
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

function getCandidates(role, dateText) {
  return getEligibleEmployees(dateText).filter(employee => {
    if (isEmployeeExcludedFromOtRecommendation(employee, dateText)) return false;
    if (role === "mri") return canEmployeeDoMriOnDate(employee, dateText);
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

  const dateText = elements.selectedDateInput.value;
  const mriEmployee = appData.employees.find(employee => employee.id === mriEmployeeId);
  const xrayEmployee = appData.employees.find(employee => employee.id === xrayEmployeeId);
  if (!mriEmployee || !xrayEmployee) return false;

  const xrayEmployeeIsSenior = getEmployeeOrder(xrayEmployeeId) < getEmployeeOrder(mriEmployeeId);
  const swappedRolesAreValid = canEmployeeDoMriOnDate(xrayEmployee, dateText);
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

  const mriCandidates = getCandidates("mri", dateText);
  const xrayCandidates = getCandidates("xray", dateText);

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
  const candidates = getCandidates(role, dateText).filter(employee => {
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

  setWarnings(warnings);
  renderFairness();
  refreshOtRoleOptions();
  showMessage(`${role === "mri" ? "MRI" : "X-ray"} 차선 담당자를 추천했습니다.`);
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

  const eligible = getMonthlyFairnessEmployees(monthKey, stats);
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
  refreshOtRoleOptions();
  setWarnings(result.warnings);
  renderFairness();
  showMessage(swapped ? `${result.date} 추천이 완료되었습니다. 선임 순서 기준으로 MRI/X-ray 역할을 조정했습니다.` : `${result.date} 추천이 완료되었습니다.`);
}

function renderEmployeeOptions() {
  const selectedDate = elements.selectedDateInput.value;
  const activeEmployees = getActiveEmployees(selectedDate);
  const otEligibleEmployees = activeEmployees.filter(employee => isEmployeeOtEligibleOnDate(employee, selectedDate));
  const nightEligibleEmployees = activeEmployees.filter(employee => isEmployeeNightEligibleOnDate(employee, selectedDate));
  const otMriOptionHtml = otEligibleEmployees
    .filter(employee => canEmployeeDoMriOnDate(employee, selectedDate))
    .map(employee => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
    .join("");
  const otOptionHtml = otEligibleEmployees
    .map(employee => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
    .join("");
  const nightMriOptionHtml = nightEligibleEmployees
    .filter(employee => canEmployeeDoMriOnDate(employee, selectedDate))
    .map(employee => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
    .join("");
  const nightOptionHtml = nightEligibleEmployees
    .map(employee => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
    .join("");
  elements.manualMriSelect.innerHTML = `<option value="">선택 없음</option>${otMriOptionHtml}`;
  elements.manualXraySelect.innerHTML = `<option value="">선택 없음</option>${otOptionHtml}`;
  refreshOtRoleOptions();
  elements.nightMriSelect.innerHTML = `<option value="">선택 없음</option>${nightMriOptionHtml}`;
  elements.nightXraySelect.innerHTML = `<option value="">선택 없음</option>${nightOptionHtml}`;
  elements.attendanceNameSelect.innerHTML = `<option value="">직원 선택</option>${activeEmployees
    .map(employee => `<option value="${escapeHtml(employee.name)}">${escapeHtml(employee.name)}</option>`)
    .join("")}`;
  const saturdayOffNames = new Set(getSaturdayOffRecords(selectedDate).map(record => record.name));
  elements.saturdayOffList.innerHTML = activeEmployees.length
    ? activeEmployees.map(employee => `
      <label class="saturday-off-item">
        <input type="checkbox" value="${employee.id}" ${saturdayOffNames.has(employee.name) ? "checked" : ""}>
        <span>${escapeHtml(employee.name)}</span>
      </label>
    `).join("")
    : `<p class="muted small-note">해당 날짜 기준 재직 직원이 없습니다.</p>`;
  updateSaturdayOffButtonState();
}

function updateSaturdayOffButtonState() {
  const hasSelectedEmployee = Boolean(elements.attendanceNameSelect.value);
  elements.saturdayOffBox.classList.toggle("hidden", hasSelectedEmployee);
}

function refreshOtRoleOptions() {
  const mriEmployeeId = elements.manualMriSelect.value;
  const xrayEmployeeId = elements.manualXraySelect.value;

  Array.from(elements.manualMriSelect.options).forEach(option => {
    option.disabled = Boolean(xrayEmployeeId && option.value === xrayEmployeeId);
  });
  Array.from(elements.manualXraySelect.options).forEach(option => {
    option.disabled = Boolean(mriEmployeeId && option.value === mriEmployeeId);
  });
}

function renderEmployees() {
  elements.employeeTableBody.innerHTML = appData.employees.map(employee => `
    <tr>
      <td>${escapeHtml(employee.name)}</td>
      <td>${escapeHtml(employee.hireDate || "-")}</td>
      <td>${escapeHtml(employee.retireDate || "-")}</td>
      <td>${escapeHtml(employee.mriStartDate || "-")}</td>
      <td>${escapeHtml(employee.otStartDate || "-")}</td>
      <td>${escapeHtml(employee.nightStartDate || "-")}</td>
      <td>
        <button class="small-button employee-move-button" data-action="move-employee-up" data-id="${employee.id}" aria-label="${escapeHtml(employee.name)} 위로 이동" title="위로 이동">↑</button>
        <button class="small-button employee-move-button" data-action="move-employee-down" data-id="${employee.id}" aria-label="${escapeHtml(employee.name)} 아래로 이동" title="아래로 이동">↓</button>
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

function renderAttendanceRecords() {
  const selectedDate = elements.selectedDateInput.value;
  const rows = appData.attendanceRecords
    .filter(record => record.date === selectedDate)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  elements.attendanceTableBody.innerHTML = rows.map(record => `
    <tr>
      <td>${escapeHtml(record.date)}</td>
      <td>${escapeHtml(record.name)}</td>
      <td>${record.ot}</td>
      <td>${record.otEarned}</td>
      <td>${record.otUsed}</td>
      <td>${record.nightOt}</td>
      <td>${record.holidayOt}</td>
      <td>${record.flexOt}</td>
      <td>${escapeHtml(record.off)}</td>
      <td>${escapeHtml(record.note)}</td>
      <td>
        <button class="small-button" data-action="edit-attendance" data-date="${escapeHtml(record.date)}" data-name="${escapeHtml(record.name)}">수정</button>
        <button class="small-button" data-action="delete-attendance" data-date="${escapeHtml(record.date)}" data-name="${escapeHtml(record.name)}">삭제</button>
      </td>
    </tr>
  `).join("");
}

function getSaturdayOffRecords(dateText) {
  return appData.attendanceRecords.filter(record => record.date === dateText && record.off === "토요일OFF");
}

function buildCalendarMiddleText(dateText, employeeId = "") {
  const employeeName = employeeId ? getEmployeeName(employeeId) : "";
  const dateAttendanceRecords = appData.attendanceRecords
    .filter(record => record.date === dateText)
    .filter(record => !employeeId || record.name === employeeName);
  const saturdayOffNames = dateAttendanceRecords
    .filter(record => record.off === "토요일OFF")
    .map(record => getGivenNameOnlyByName(record.name));
  const attendanceTexts = dateAttendanceRecords
    .filter(record => record.off !== "토요일OFF")
    .map(record => {
      const name = getGivenNameOnlyByName(record.name);
      const details = [];
      if (record.off) details.push(getShortOffLabel(record.off));
      if (record.otUsed < 0) details.push(`OT ${record.otUsed}`);
      if (record.flexOt < 0) details.push(`탄력 ${record.flexOt}`);
      return details.length ? (employeeId ? details.join(" ") : `${name} ${details.join(" ")}`) : "";
    })
    .filter(Boolean);

  if (saturdayOffNames.length) {
    attendanceTexts.unshift(`OFF: ${saturdayOffNames.join("/")}`);
  }

  return attendanceTexts.join("\n");
}

function formatTimeSuffix(value) {
  return value ? `(${formatNumberForNote(value)})` : "";
}

function buildCalendarTooltipText(dateText, record, middleText, missingWorkTime, employeeId = "") {
  const lines = [];
  const ownAssignment = employeeId ? getOwnAssignmentIds(record, employeeId) : null;

  if (record?.needsOt && (!employeeId || ownAssignment.ot.length)) {
    const mriAttendance = getAttendanceRecord(record.date, getEmployeeName(record.mriEmployeeId));
    const xrayAttendance = getAttendanceRecord(record.date, getEmployeeName(record.xrayEmployeeId));
    lines.push(employeeId
      ? `OT: ${ownAssignment.ot.map(assignmentId => formatOwnCalendarAssignment(dateText, assignmentId, "otEarned")).join("/")}`
      : `OT: ${getGivenNameOnly(record.mriEmployeeId)}${formatTimeSuffix(mriAttendance?.otEarned)}/${getGivenNameOnly(record.xrayEmployeeId)}${formatTimeSuffix(xrayAttendance?.otEarned)}`);
  }

  const attendanceLines = appData.attendanceRecords
    .filter(attendanceRecord => attendanceRecord.date === dateText)
    .filter(attendanceRecord => !employeeId || attendanceRecord.name === getEmployeeName(employeeId))
    .map(attendanceRecord => buildAttendanceTooltipLine(attendanceRecord, Boolean(employeeId)))
    .filter(Boolean);

  lines.push(...attendanceLines);

  if ((record?.nightMriEmployeeId || record?.nightXrayEmployeeId) && (!employeeId || ownAssignment.night.length)) {
    const nightMriAttendance = getAttendanceRecord(record.date, getEmployeeName(record.nightMriEmployeeId));
    const nightXrayAttendance = getAttendanceRecord(record.date, getEmployeeName(record.nightXrayEmployeeId));
    lines.push(employeeId
      ? `야간: ${ownAssignment.night.map(assignmentId => formatOwnCalendarAssignment(dateText, assignmentId, "nightOt")).join("/")}`
      : `야간: ${getGivenNameOnly(record.nightMriEmployeeId)}${formatTimeSuffix(nightMriAttendance?.nightOt)}/${getGivenNameOnly(record.nightXrayEmployeeId)}${formatTimeSuffix(nightXrayAttendance?.nightOt)}`);
  }

  if (!lines.length && middleText) {
    lines.push(middleText);
  }

  if (missingWorkTime) {
    lines.push("시간 입력 필요");
  }

  return lines.join("\n");
}

function buildAttendanceTooltipLine(record, mineOnly = false) {
  const name = getGivenNameOnlyByName(record.name);
  const details = [];

  if (record.off === "토요일OFF") {
    details.push("OFF");
  } else if (record.off) {
    details.push(getShortOffLabel(record.off));
  }

  if (record.otUsed < 0) details.push(`OT ${record.otUsed}`);
  if (record.flexOt !== 0) details.push(`탄력 ${record.flexOt}`);
  if (record.holidayOt !== 0) details.push(`휴일 ${record.holidayOt}`);
  const manualNote = stripAutoOtNotePrefix(record.note);
  if (manualNote) details.push(manualNote);

  return details.length ? (mineOnly ? details.join(" ") : `${name} ${details.join(" ")}`) : "";
}

function hasMissingWorkTime(record, employeeId = "") {
  if (!record) return false;

  if (employeeId) {
    const ownAssignment = getOwnAssignmentIds(record, employeeId);
    if (record.needsOt && ownAssignment.ot.length) {
      return ownAssignment.ot.some(assignmentId => !getAttendanceRecord(record.date, getEmployeeName(assignmentId))?.otEarned);
    }
    if (ownAssignment.night.length) {
      return ownAssignment.night.some(assignmentId => !getAttendanceRecord(record.date, getEmployeeName(assignmentId))?.nightOt);
    }
    return false;
  }

  if (record.needsOt) {
    const mriAttendance = getAttendanceRecord(record.date, getEmployeeName(record.mriEmployeeId));
    const xrayAttendance = getAttendanceRecord(record.date, getEmployeeName(record.xrayEmployeeId));
    if (!mriAttendance?.otEarned || !xrayAttendance?.otEarned) return true;
  }

  if (record.nightMriEmployeeId || record.nightXrayEmployeeId) {
    const nightMriAttendance = getAttendanceRecord(record.date, getEmployeeName(record.nightMriEmployeeId));
    const nightXrayAttendance = getAttendanceRecord(record.date, getEmployeeName(record.nightXrayEmployeeId));
    if (!nightMriAttendance?.nightOt || !nightXrayAttendance?.nightOt) return true;
  }

  return false;
}

function getOwnAssignmentIds(record, employeeId) {
  if (!record || !employeeId) return { ot: [], night: [] };
  const id = String(employeeId);
  return {
    ot: [record.mriEmployeeId, record.xrayEmployeeId].filter(value => String(value || "") === id),
    night: [record.nightMriEmployeeId, record.nightXrayEmployeeId].filter(value => String(value || "") === id)
  };
}

function formatOwnCalendarAssignment(dateText, employeeId, fieldName) {
  const attendance = getAttendanceRecord(dateText, getEmployeeName(employeeId));
  const value = Number(attendance?.[fieldName] || 0);
  return value > 0 ? formatNumberForNote(value) : "있음";
}

function hasCalendarDataForEmployee(dateText, record, employeeId) {
  if (!employeeId) return false;
  const ownAssignment = getOwnAssignmentIds(record, employeeId);
  const ownName = getEmployeeName(employeeId);
  return ownAssignment.ot.length > 0 || ownAssignment.night.length > 0 ||
    appData.attendanceRecords.some(item => item.date === dateText && item.name === ownName);
}

function getShortOffLabel(offText) {
  if (offText === "오전반차") return "전반";
  if (offText === "오후반차") return "후반";
  return offText;
}

function renderMonthlySummary() {
  const monthKey = getMonthKey(elements.selectedDateInput.value);
  const stats = buildEmployeeStats(monthKey);
  const rows = [...stats.values()]
    .filter(item => isEmployeeRelevantForMonth(item.employee, monthKey) || item.total > 0)
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
  const recordDates = new Set();

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
    if (selectedAnnualLeaveDates.has(dateText)) classes.push("is-annual-selected");
    if (dateText === todayText) classes.push("is-today");
    if (weekday === 0) classes.push("is-sunday");
    if (weekday === 6) classes.push("is-saturday");

    const record = appData.records.find(item => item.date === dateText);
    const missingWorkTime = hasMissingWorkTime(record, adminOnlyMyAttendance ? adminEmployeeId : "");
    if (missingWorkTime) classes.push("needs-time-input");
    const ownAssignment = adminOnlyMyAttendance ? getOwnAssignmentIds(record, adminEmployeeId) : null;
    const hasOwnData = hasCalendarDataForEmployee(dateText, record, adminEmployeeId);
    const hasVisibleData = adminOnlyMyAttendance
      ? hasOwnData
      : Boolean(record || appData.attendanceRecords.some(item => item.date === dateText));
    if (hasVisibleData) {
      recordDates.add(dateText);
    }
    if (recordDates.has(dateText)) classes.push("has-record");
    const otText = record?.needsOt && (!adminOnlyMyAttendance || ownAssignment.ot.length)
      ? adminOnlyMyAttendance
        ? `OT: ${ownAssignment.ot.map(employeeId => formatOwnCalendarAssignment(dateText, employeeId, "otEarned")).join("/")}`
        : `OT: ${getGivenNameOnly(record.mriEmployeeId)}/${getGivenNameOnly(record.xrayEmployeeId)}`
      : "";
    const nightText = (record?.nightMriEmployeeId || record?.nightXrayEmployeeId) &&
      (!adminOnlyMyAttendance || ownAssignment.night.length)
      ? adminOnlyMyAttendance
        ? `야간: ${ownAssignment.night.map(employeeId => formatOwnCalendarAssignment(dateText, employeeId, "nightOt")).join("/")}`
        : `야간: ${getGivenNameOnly(record.nightMriEmployeeId)}/${getGivenNameOnly(record.nightXrayEmployeeId)}`
      : "";
    const middleText = buildCalendarMiddleText(dateText, adminOnlyMyAttendance ? adminEmployeeId : "");
    const dayTooltipText = buildCalendarTooltipText(dateText, record, middleText, missingWorkTime, adminOnlyMyAttendance ? adminEmployeeId : "");
    cells.push(`
      <button class="${classes.join(" ")}" type="button" data-date="${dateText}">
        <span class="calendar-day-number">${day}</span>
        <span class="calendar-day-info">
          <span class="${otText ? "calendar-day-note" : "calendar-day-note-empty"}" data-tooltip="${escapeHtml(dayTooltipText)}">${escapeHtml(otText || "-")}</span>
          <span class="${middleText ? "calendar-day-note calendar-day-note-off" : "calendar-day-note-empty"}" data-tooltip="${escapeHtml(dayTooltipText)}">${escapeHtml(middleText || "-")}</span>
          <span class="${nightText ? "calendar-day-note calendar-day-note-night" : "calendar-day-note-empty calendar-day-note-night"}" data-tooltip="${escapeHtml(dayTooltipText)}">${escapeHtml(nightText || "-")}</span>
        </span>
      </button>
    `);
  }

  elements.calendarGrid.innerHTML = cells.join("");
}

function ensureCalendarTooltipElement() {
  if (calendarTooltipElement) return calendarTooltipElement;

  calendarTooltipElement = document.createElement("div");
  calendarTooltipElement.className = "calendar-tooltip hidden";
  document.body.appendChild(calendarTooltipElement);
  return calendarTooltipElement;
}

function showCalendarTooltip(text, event) {
  if (!text) return;
  const tooltip = ensureCalendarTooltipElement();
  tooltip.textContent = text;
  tooltip.classList.remove("hidden");
  moveCalendarTooltip(event);
}

function moveCalendarTooltip(event) {
  if (!calendarTooltipElement || calendarTooltipElement.classList.contains("hidden")) return;
  const margin = 14;
  const tooltipRect = calendarTooltipElement.getBoundingClientRect();
  let left = event.clientX + margin;
  let top = event.clientY + margin;

  if (left + tooltipRect.width > window.innerWidth - margin) {
    left = event.clientX - tooltipRect.width - margin;
  }
  if (top + tooltipRect.height > window.innerHeight - margin) {
    top = event.clientY - tooltipRect.height - margin;
  }

  calendarTooltipElement.style.left = `${Math.max(margin, left)}px`;
  calendarTooltipElement.style.top = `${Math.max(margin, top)}px`;
}

function hideCalendarTooltip() {
  if (!calendarTooltipElement) return;
  calendarTooltipElement.classList.add("hidden");
}

function renderAll() {
  elements.selectedWeekday.textContent = weekdayNames[getWeekday(elements.selectedDateInput.value)];
  renderCalendar();
  renderEmployeeOptions();
  renderEmployees();
  renderRecords();
  renderAttendanceRecords();
  renderMonthlySummary();
  renderFairness();
}

function resetEmployeeForm() {
  elements.employeeIdInput.value = "";
  elements.employeeNameInput.value = "";
  elements.employeeHireDateInput.value = "";
  elements.employeeRetireDateInput.value = "";
  elements.employeeMriStartDateInput.value = "";
  elements.employeeOtStartDateInput.value = "";
  elements.employeeNightStartDateInput.value = "";
}

function setEmployeeFormVisible(visible) {
  elements.employeeForm.classList.toggle("hidden", !visible);
  elements.showEmployeeFormButton.classList.toggle("hidden", visible);
}

function resetRecommendationView() {
  currentRecommendation = null;
  elements.mriRecommendationName.textContent = "추천 전";
  elements.mriRecommendationReason.textContent = "추천 버튼을 누르면 사유가 표시됩니다.";
  elements.xrayRecommendationName.textContent = "추천 전";
  elements.xrayRecommendationReason.textContent = "추천 버튼을 누르면 사유가 표시됩니다.";
  elements.manualMriSelect.value = "";
  elements.manualXraySelect.value = "";
  refreshOtRoleOptions();
  elements.manualMriOtInput.value = "";
  elements.manualXrayOtInput.value = "";
  elements.nightMriSelect.value = "";
  elements.nightXraySelect.value = "";
  elements.nightMriOtInput.value = "";
  elements.nightXrayOtInput.value = "";
  elements.recordMemoInput.value = "";
  setWarnings([]);
  hideMessage();
}

function resetAttendanceForm(keepName = false) {
  if (!keepName) {
    elements.attendanceNameSelect.value = "";
  }
  elements.attendanceOtInput.value = "";
  elements.attendanceOtUsedInput.value = "";
  elements.attendanceNightOtInput.value = "";
  elements.attendanceHolidayOtInput.value = "";
  elements.attendanceFlexEarnedInput.value = "";
  elements.attendanceFlexUsedInput.value = "";
  elements.attendanceFlexReasonInput.value = "";
  elements.attendanceOffSelect.value = "";
  elements.attendanceManualNoteInput.value = "";
  elements.attendanceAutoNoteInput.value = "";
  selectedAnnualLeaveDates.clear();
  updateAnnualLeaveView();
  updateSaturdayOffButtonState();
}

function updateAnnualLeaveView() {
  const annualLeaveMode = elements.attendanceOffSelect.value === "연차";
  elements.annualLeaveBox.classList.toggle("hidden", !annualLeaveMode);
  if (!annualLeaveMode) selectedAnnualLeaveDates.clear();

  const dates = Array.from(selectedAnnualLeaveDates).sort();
  elements.annualLeaveSelectionSummary.textContent = dates.length
    ? `${dates.length}일 선택됨: ${dates.join(", ")}`
    : "달력에서 연차를 사용할 날짜를 하나씩 선택해 주세요.";
  elements.saveAnnualLeaveButton.disabled = !annualLeaveMode || dates.length === 0;
  renderCalendar();
}

function setInputSectionVisibility(sectionName) {
  elements.otInputSection.classList.toggle("hidden", sectionName !== "ot");
  elements.nightInputSection.classList.toggle("hidden", sectionName !== "night");
  elements.attendanceInputSection.classList.toggle("hidden", sectionName !== "attendance");
  elements.showOtInputButton.classList.toggle("is-active-mode", sectionName === "ot");
  elements.showNightInputButton.classList.toggle("is-active-mode", sectionName === "night");
  elements.showAttendanceInputButton.classList.toggle("is-active-mode", sectionName === "attendance");
}

function loadSelectedRecordIntoForm() {
  const record = appData.records.find(item => item.date === elements.selectedDateInput.value);

  elements.manualMriSelect.value = record?.mriEmployeeId || "";
  elements.manualXraySelect.value = record?.xrayEmployeeId || "";
  refreshOtRoleOptions();
  elements.nightMriSelect.value = record?.nightMriEmployeeId || "";
  elements.nightXraySelect.value = record?.nightXrayEmployeeId || "";
  elements.recordMemoInput.value = record?.memo || "";
  elements.manualMriOtInput.value = "";
  elements.manualXrayOtInput.value = "";
  elements.nightMriOtInput.value = "";
  elements.nightXrayOtInput.value = "";

  if (record?.mriEmployeeId) {
    const mriAttendance = getAttendanceRecord(record.date, getEmployeeName(record.mriEmployeeId));
    elements.manualMriOtInput.value = mriAttendance?.otEarned || "";
  }
  if (record?.xrayEmployeeId) {
    const xrayAttendance = getAttendanceRecord(record.date, getEmployeeName(record.xrayEmployeeId));
    elements.manualXrayOtInput.value = xrayAttendance?.otEarned || "";
  }
  if (record?.nightMriEmployeeId) {
    const nightMriAttendance = getAttendanceRecord(record.date, getEmployeeName(record.nightMriEmployeeId));
    elements.nightMriOtInput.value = nightMriAttendance?.nightOt || "";
  }
  if (record?.nightXrayEmployeeId) {
    const nightXrayAttendance = getAttendanceRecord(record.date, getEmployeeName(record.nightXrayEmployeeId));
    elements.nightXrayOtInput.value = nightXrayAttendance?.nightOt || "";
  }

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

function getAttendanceRecord(date, name) {
  return appData.attendanceRecords.find(record => record.date === date && record.name === name);
}

function upsertAttendanceTime(date, employeeId, fieldName, value) {
  if (value === "") return;

  const name = getEmployeeName(employeeId);
  if (!name || name === "-") return;

  const existingRecord = getAttendanceRecord(date, name) || normalizeAttendanceRecord({ date, name });
  const updates = fieldName === "ot"
    ? { otEarned: toNumberOrZero(value) }
    : { [fieldName]: toNumberOrZero(value) };
  const updatedRecord = normalizeAttendanceRecord({
    ...existingRecord,
    ...updates
  });

  appData.attendanceRecords = appData.attendanceRecords.filter(record => !(record.date === date && record.name === name));
  appData.attendanceRecords.push(updatedRecord);
}

function upsertAttendanceRecordByName(date, name, updates) {
  if (!name) return;

  const existingRecord = getAttendanceRecord(date, name) || normalizeAttendanceRecord({ date, name });
  const normalizedUpdates = { ...updates };
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, "otUsed")) {
    normalizedUpdates.otUsed = normalizeOtUsedValue(normalizedUpdates.otUsed);
  }
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, "flexUsed")) {
    normalizedUpdates.flexUsed = normalizeUsedValue(normalizedUpdates.flexUsed);
  }
  const updatedRecord = normalizeAttendanceRecord({
    ...existingRecord,
    ...normalizedUpdates,
    date,
    name
  });

  appData.attendanceRecords = appData.attendanceRecords.filter(record => !(record.date === date && record.name === name));
  appData.attendanceRecords.push(updatedRecord);
}

async function saveSaturdayOff() {
  const date = elements.selectedDateInput.value;
  const saturdayOffEmployeeIds = Array.from(elements.saturdayOffList.querySelectorAll("input[type='checkbox']:checked"))
    .map(input => input.value);
  const weekday = getWeekday(date);

  if (weekday !== 6) {
    showMessage("토요일 OFF는 토요일 날짜에서만 저장할 수 있습니다.", "error");
    return;
  }

  if (!saturdayOffEmployeeIds.length) {
    showMessage("토요일 OFF 직원을 한 명 이상 선택해 주세요.", "error");
    return;
  }

  const activeEmployees = getActiveEmployees(date);
  const offEmployeeIdSet = new Set(saturdayOffEmployeeIds);
  const offEmployees = activeEmployees.filter(employee => offEmployeeIdSet.has(employee.id));
  if (offEmployees.length !== saturdayOffEmployeeIds.length) {
    showMessage("선택한 직원 중 해당 날짜 기준 재직 대상자가 아닌 직원이 있습니다.", "error");
    return;
  }

  if (!window.confirm(`${date} 토요일 OFF ${offEmployees.length}명을 저장하고, 나머지 재직 직원에게 holidayOt 4시간을 입력할까요?`)) {
    return;
  }

  activeEmployees.forEach(employee => {
    if (offEmployeeIdSet.has(employee.id)) {
      upsertAttendanceRecordByName(date, employee.name, { off: "토요일OFF", holidayOt: 0 });
      return;
    }

    const existingRecord = getAttendanceRecord(date, employee.name);
    const nextOff = existingRecord?.off === "토요일OFF" ? "" : existingRecord?.off || "";
    upsertAttendanceRecordByName(date, employee.name, { off: nextOff, holidayOt: 4 });
  });

  await saveData();
  renderAll();
  showMessage(`${date} 토요일 OFF ${offEmployees.length}명과 휴일근무 4시간을 저장했습니다.`);
}

function loadAttendanceRecordIntoForm(date, name) {
  const record = appData.attendanceRecords.find(item => item.date === date && item.name === name);
  elements.attendanceNameSelect.value = name || "";
  updateSaturdayOffButtonState();

  if (!record) {
    resetAttendanceForm(true);
    return;
  }

  elements.attendanceOtInput.value = record.otEarned || "";
  elements.attendanceOtUsedInput.value = record.otUsed || "";
  elements.attendanceNightOtInput.value = record.nightOt || "";
  elements.attendanceHolidayOtInput.value = record.holidayOt || "";
  elements.attendanceFlexEarnedInput.value = record.flexEarned || "";
  elements.attendanceFlexUsedInput.value = record.flexUsed || "";
  elements.attendanceFlexReasonInput.value = record.flexReason || "";
  elements.attendanceOffSelect.value = record.off || "";
  elements.attendanceManualNoteInput.value = record.manualNote !== undefined
    ? record.manualNote || ""
    : stripAutoOtNotePrefix(record.note || "");
  syncAttendanceNoteWithOtInputs();
  updateAnnualLeaveView();
}

async function saveAttendanceRecord() {
  const date = elements.selectedDateInput.value;
  const name = elements.attendanceNameSelect.value;

  if (!name) {
    showMessage("근태를 기록할 직원을 선택해 주세요.", "error");
    return;
  }
  if (toNumberOrZero(elements.attendanceFlexEarnedInput.value) !== 0 && !elements.attendanceFlexReasonInput.value.trim()) {
    showMessage("flexOt 한 시간을 입력한 경우 flexOt 이유를 반드시 입력해 주세요.", "error");
    return;
  }
  syncAttendanceNoteWithOtInputs();

  const attendanceRecord = normalizeAttendanceRecord({
    date,
    name,
    otEarned: elements.attendanceOtInput.value,
    otUsed: normalizeOtUsedValue(elements.attendanceOtUsedInput.value),
    nightOt: elements.attendanceNightOtInput.value,
    holidayOt: elements.attendanceHolidayOtInput.value,
    flexEarned: elements.attendanceFlexEarnedInput.value,
    flexUsed: normalizeUsedValue(elements.attendanceFlexUsedInput.value),
    flexReason: elements.attendanceFlexReasonInput.value.trim(),
    off: elements.attendanceOffSelect.value,
    manualNote: elements.attendanceManualNoteInput.value.trim()
  });

  appData.attendanceRecords = appData.attendanceRecords.filter(record => !(record.date === date && record.name === name));
  appData.attendanceRecords.push(attendanceRecord);

  await saveData();
  renderAll();
  resetAttendanceForm(true);
  showMessage(`${date} ${name} 근태 기록을 저장했습니다.`);
}

async function saveAnnualLeaveRecords() {
  const name = elements.attendanceNameSelect.value;
  const dates = Array.from(selectedAnnualLeaveDates).sort();

  if (!name) {
    showMessage("연차를 기록할 직원을 선택해 주세요.", "error");
    return;
  }
  if (!dates.length) {
    showMessage("달력에서 연차 날짜를 한 개 이상 선택해 주세요.", "error");
    return;
  }

  const existingDates = dates.filter(date => getAttendanceRecord(date, name));
  if (existingDates.length && !window.confirm(`${existingDates.join(", ")}에 이미 근태 기록이 있습니다. 연차로 변경할까요?`)) {
    return;
  }

  dates.forEach(date => {
    upsertAttendanceRecordByName(date, name, { off: "연차" });
  });

  await saveData();
  selectedAnnualLeaveDates.clear();
  renderAll();
  updateAnnualLeaveView();
  showMessage(`${name}님의 연차 ${dates.length}일을 등록했습니다.`);
}

async function deleteAttendanceRecord(date, name) {
  if (!window.confirm(`${date} ${name} 근태 기록을 삭제할까요?`)) return;

  appData.attendanceRecords = appData.attendanceRecords.filter(record => !(record.date === date && record.name === name));
  await saveData();
  renderAll();
  resetAttendanceForm();
  showMessage("근태 기록이 삭제되었습니다.");
}

async function saveRecord() {
  const date = elements.selectedDateInput.value;
  const mriEmployeeId = elements.manualMriSelect.value;
  const xrayEmployeeId = elements.manualXraySelect.value;
  const nightMriEmployeeId = elements.nightMriSelect.value;
  const nightXrayEmployeeId = elements.nightXraySelect.value;
  const mriOtValue = elements.manualMriOtInput.value;
  const xrayOtValue = elements.manualXrayOtInput.value;
  const nightMriOtValue = elements.nightMriOtInput.value;
  const nightXrayOtValue = elements.nightXrayOtInput.value;
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
    const xrayEmployee = appData.employees.find(employee => employee.id === xrayEmployeeId);
    if (!isEmployeeOtEligibleOnDate(mriEmployee, date) || !isEmployeeOtEligibleOnDate(xrayEmployee, date)) {
      showMessage("조기출근 담당자는 해당 날짜 기준 입사일 이후, 퇴사일 이전인 직원만 선택할 수 있습니다.", "error");
      return;
    }
    if (!canEmployeeDoMriOnDate(mriEmployee, date)) {
      showMessage("MRI 담당자는 해당 날짜 기준 MRI 가능 직원이어야 합니다.", "error");
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
    const nightXrayEmployee = appData.employees.find(employee => employee.id === nightXrayEmployeeId);
    if (!isEmployeeNightEligibleOnDate(nightMriEmployee, date) || !isEmployeeNightEligibleOnDate(nightXrayEmployee, date)) {
      showMessage("야간 담당자는 해당 날짜 기준 입사일 이후, 퇴사일 이전인 직원만 선택할 수 있습니다.", "error");
      return;
    }
    if (!canEmployeeDoMriOnDate(nightMriEmployee, date)) {
      showMessage("야간 MRI 담당자는 해당 날짜 기준 MRI 가능 직원이어야 합니다.", "error");
      return;
    }
    if (!isEmployeeNightEligibleOnDate(nightMriEmployee, date)) {
      showMessage("야간 MRI 담당자는 야간 대상 직원이어야 합니다.", "error");
      return;
    }
    if (!isEmployeeNightEligibleOnDate(nightXrayEmployee, date)) {
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

  if (needsOt) {
    upsertAttendanceTime(date, mriEmployeeId, "ot", mriOtValue);
    upsertAttendanceTime(date, xrayEmployeeId, "ot", xrayOtValue);
  }

  if (hasNightInput) {
    upsertAttendanceTime(date, nightMriEmployeeId, "nightOt", nightMriOtValue);
    upsertAttendanceTime(date, nightXrayEmployeeId, "nightOt", nightXrayOtValue);
  }

  await saveData();
  renderAll();
  loadSelectedRecordIntoForm();
  showMessage("기록이 저장되었습니다.");
}

function editEmployee(employeeId) {
  const employee = appData.employees.find(item => item.id === employeeId);
  if (!employee) return;
  setEmployeeFormVisible(true);
  elements.employeeIdInput.value = employee.id;
  elements.employeeNameInput.value = employee.name;
  elements.employeeHireDateInput.value = employee.hireDate || "";
  elements.employeeRetireDateInput.value = employee.retireDate || "";
  elements.employeeMriStartDateInput.value = employee.mriStartDate || "";
  elements.employeeOtStartDateInput.value = employee.otStartDate || "";
  elements.employeeNightStartDateInput.value = employee.nightStartDate || "";
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

async function moveEmployee(employeeId, direction) {
  const currentIndex = appData.employees.findIndex(employee => employee.id === employeeId);
  if (currentIndex < 0) return;

  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= appData.employees.length) return;

  const nextEmployees = [...appData.employees];
  [nextEmployees[currentIndex], nextEmployees[targetIndex]] = [nextEmployees[targetIndex], nextEmployees[currentIndex]];
  appData.employees = nextEmployees;

  await saveData();
  renderAll();
  loadSelectedRecordIntoForm();
  showMessage("직원 순서를 저장했습니다. 같은 점수일 때 위에 있는 직원이 먼저 추천됩니다.");
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

function exportAttendanceCsv() {
  const header = ["date", "name", "ot", "nightOt", "holidayOt", "flexOt", "off", "note"];
  const rows = [...appData.attendanceRecords]
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "ko"))
    .map(record => [
      record.date,
      record.name,
      record.ot,
      record.nightOt,
      record.holidayOt,
      record.flexOt,
      record.off === "토요일OFF" ? "" : record.off,
      record.note
    ]);

  const csv = [header, ...rows]
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  downloadTextFile(`근태_기록_${getTodayText()}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
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

function setServerStatus(message, type = "info") {
  if (!elements.serverStatusBox) return;
  elements.serverStatusBox.textContent = message;
  elements.serverStatusBox.style.background = type === "error" ? "#ffe0dd" : "#e9f5ef";
  elements.serverStatusBox.style.color = type === "error" ? "#9f241c" : "#144b36";
}

function setServerRecoveryButtonVisible(visible) {
  if (!elements.serverReloadButton) return;
  elements.serverReloadButton.classList.toggle("hidden", !visible);
}

function setAdminGateMessage(message, type = "info") {
  elements.adminGateMessage.textContent = message;
  elements.adminGateMessage.classList.remove("hidden");
  elements.adminGateMessage.style.background = type === "error" ? "#ffe0dd" : "#e9f5ef";
  elements.adminGateMessage.style.color = type === "error" ? "#9f241c" : "#144b36";
}

function showAdminApp() {
  elements.adminLoginScreen.classList.add("hidden");
  elements.adminAppShell.classList.remove("hidden");
}

function updateAdminAttendanceButton(user) {
  adminEmployeeId = user?.employeeId ? String(user.employeeId) : "";
  adminOnlyMyAttendance = false;
  elements.adminMyAttendanceToggleButton.classList.toggle("hidden", !adminEmployeeId);
  elements.adminMyAttendanceToggleButton.textContent = "내 근태 보기";
}

function showAdminLogin() {
  elements.adminLoginScreen.classList.remove("hidden");
  elements.adminAppShell.classList.add("hidden");
}

function getAdminLoginCredentials() {
  return {
    username: elements.adminGateUsernameInput.value.trim(),
    password: elements.adminGatePasswordInput.value
  };
}

async function serverRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "서버 요청에 실패했습니다.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function loadServerSyncState() {
  const payload = await serverRequest("/api/admin/sync-state");
  serverSyncVersion = payload.version ?? 0;
  return serverSyncVersion;
}

async function reloadServerLatestData() {
  try {
    await loadServerCalendarMonth();
    await loadServerUsersAndEmployees();
    await loadServerMonthlySummary();
    setServerRecoveryButtonVisible(false);
    setServerStatus("서버 최신본을 다시 불러왔습니다.");
  } catch (error) {
    setServerStatus(error.message || "서버 최신본을 다시 불러오지 못했습니다.", "error");
  }
}

async function checkServerSession() {
  if (!elements.serverStatusBox) return;
  try {
    const payload = await serverRequest("/api/auth/me");
    if (payload.user.role !== "admin") {
      serverAutoSyncEnabled = false;
      serverSyncVersion = null;
      window.location.href = "./user.html";
      return;
    }
    updateAdminAttendanceButton(payload.user);
    serverAutoSyncEnabled = true;
    showAdminApp();
    setServerStatus(`${payload.user.username} 계정으로 로그인 중입니다. 권한: ${payload.user.role}`);
    try {
      await loadServerSyncState();
      await loadServerCalendarMonth();
      await loadServerUsersAndEmployees();
      await loadServerMonthlySummary();
    } catch (loadError) {
      setServerStatus(loadError.message || "서버 데이터를 불러오지 못했습니다.", "error");
    }
  } catch (error) {
    serverAutoSyncEnabled = false;
    serverSyncVersion = null;
    showAdminLogin();
    setServerStatus("서버 로그인 전입니다. 서버 기능을 쓰려면 관리자 로그인이 필요합니다.", "error");
  }
}

async function loginServerAdmin(usernameOverride = "", passwordOverride = "") {
  try {
    const credentials = getAdminLoginCredentials();
    const username = usernameOverride || credentials.username;
    const password = passwordOverride || credentials.password;
    if (!username || !password) {
      setServerStatus("관리자 ID와 비밀번호를 입력해 주세요.", "error");
      return;
    }

    const payload = await serverRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    elements.adminGatePasswordInput.value = "";
    if (payload.user.role !== "admin") {
      serverAutoSyncEnabled = false;
      serverSyncVersion = null;
      window.location.href = "./user.html";
      return;
    }
    updateAdminAttendanceButton(payload.user);
    serverAutoSyncEnabled = true;
    showAdminApp();
    setServerStatus(`${payload.user.username} 계정으로 로그인했습니다. 권한: ${payload.user.role}`);
    try {
      await loadServerSyncState();
      await loadServerCalendarMonth();
      await loadServerUsersAndEmployees();
      await loadServerMonthlySummary();
    } catch (loadError) {
      setServerStatus(loadError.message || "서버 데이터를 불러오지 못했습니다.", "error");
    }
  } catch (error) {
    setServerStatus(error.message, "error");
    setAdminGateMessage(error.message, "error");
  }
}

async function logoutServerAdmin() {
  try {
    await serverRequest("/api/auth/logout", { method: "POST", body: "{}" });
    serverAutoSyncEnabled = false;
    serverSyncVersion = null;
    updateAdminAttendanceButton(null);
    setServerRecoveryButtonVisible(false);
    showAdminLogin();
    setServerStatus("로그아웃했습니다.");
  } catch (error) {
    setServerStatus(error.message, "error");
  }
}

async function importLocalBackupToServer() {
  const file = elements.serverImportFileInput.files[0];
  if (!file) {
    setServerStatus("서버로 가져올 JSON 백업 파일을 선택해 주세요.", "error");
    return;
  }

  if (!window.confirm("선택한 JSON 백업 데이터를 서버 DB로 가져올까요? 같은 직원/날짜 데이터는 갱신됩니다.")) {
    return;
  }

  try {
    const text = await file.text();
    const localData = JSON.parse(text);
    const payload = await serverRequest("/api/admin/import-local-data", {
      method: "POST",
      body: JSON.stringify(localData)
    });
    await reloadServerLatestData();
    setServerStatus(`서버 DB 가져오기 완료: 직원 ${payload.summary.employees}명, 근무기록 ${payload.summary.workRecords}건, 근태 ${payload.summary.attendanceRecords}건`);
  } catch (error) {
    setServerStatus(error.message || "서버 DB 가져오기에 실패했습니다.", "error");
  }
}

function formatServerNumber(value) {
  const numberValue = Number(value || 0);
  return Number.isInteger(numberValue) ? String(numberValue) : String(numberValue);
}

async function loadServerMonthlySummary() {
  try {
    const month = getMonthKey(elements.selectedDateInput.value);
    const payload = await serverRequest(`/api/admin/monthly-summary?month=${encodeURIComponent(month)}`);
    elements.serverSummaryBody.innerHTML = payload.rows.map(row => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${formatServerNumber(row.totalOt)}</td>
        <td>${formatServerNumber(row.otEarned)}</td>
        <td>${formatServerNumber(row.otUsed)}</td>
        <td>${formatServerNumber(row.nightOt)}</td>
        <td>${formatServerNumber(row.holidayOt)}</td>
        <td>${formatServerNumber(row.flexOt)}</td>
        <td>${row.annualLeaveCount || 0}</td>
        <td>${row.morningHalfCount || 0}</td>
        <td>${row.afternoonHalfCount || 0}</td>
      </tr>
    `).join("");
    setServerStatus(`${payload.month} 서버 월간 요약을 불러왔습니다.`);
  } catch (error) {
    setServerStatus(error.message || "서버 월간 요약을 불러오지 못했습니다.", "error");
  }
}

async function loadServerCalendarMonth() {
  try {
    const month = getMonthKey(elements.selectedDateInput.value);
    const payload = await serverRequest("/api/admin/data");
    appData = normalizeData(payload.data);
    serverSyncVersion = payload.version ?? 0;
    serverViewMode = true;
    serverAutoSyncEnabled = true;
    setServerRecoveryButtonVisible(false);
    renderAll();
    loadSelectedRecordIntoForm();
    setServerStatus(`${month} 선택 월 기준으로 서버 전체 데이터를 불러왔습니다.`);
  } catch (error) {
    setServerStatus(error.message || "서버 달력을 불러오지 못했습니다.", "error");
  }
}

async function loadServerUsersAndEmployees() {
  try {
    const [employeePayload, userPayload] = await Promise.all([
      serverRequest("/api/admin/employees"),
      serverRequest("/api/admin/users")
    ]);

    const employeesForSelect = employeePayload.employees.length ? employeePayload.employees : appData.employees;
    elements.serverUserEmployeeSelect.innerHTML = `<option value="">직원 선택</option>${employeesForSelect.map(employee => `
      <option value="${employee.id}">${escapeHtml(employee.name)}</option>
    `).join("")}`;
    elements.serverPasswordUserSelect.innerHTML = `<option value="">계정 선택</option>${userPayload.users.map(user => `
      <option value="${user.id}">${escapeHtml(user.username)} (${user.role === "admin" ? "관리자" : "일반"})</option>
    `).join("")}`;

    elements.serverUsersBody.innerHTML = userPayload.users.map(user => `
      <tr>
        <td>${escapeHtml(user.username)}</td>
        <td>${user.role === "admin" ? "관리자" : "일반"}</td>
        <td>${escapeHtml(user.employeeName || "-")}</td>
        <td>
          <div class="button-row server-role-actions">
            <select data-role-user-id="${user.id}" aria-label="${escapeHtml(user.username)} 권한">
              <option value="user" ${user.role === "user" ? "selected" : ""}>일반 유저</option>
              <option value="admin" ${user.role === "admin" ? "selected" : ""}>관리자</option>
            </select>
            <button type="button" data-change-role-user-id="${user.id}">권한 저장</button>
          </div>
        </td>
      </tr>
    `).join("");
    if (!employeePayload.employees.length && appData.employees.length) {
      setServerStatus("서버 직원 목록이 비어 있어 현재 화면의 직원 목록을 임시로 표시했습니다. 서버에 저장하면 목록이 다시 채워집니다.");
      return;
    }
    setServerStatus("서버 계정 목록을 불러왔습니다.");
  } catch (error) {
    setServerStatus(error.message || "서버 계정 목록을 불러오지 못했습니다.", "error");
  }
}

function openServerAccountForm(form) {
  elements.serverCreateUserForm.classList.add("hidden");
  elements.serverChangePasswordForm.classList.add("hidden");
  form.classList.remove("hidden");
}

function closeServerAccountForms() {
  elements.serverCreateUserForm.classList.add("hidden");
  elements.serverChangePasswordForm.classList.add("hidden");
  elements.serverNewUsernameInput.value = "";
  elements.serverNewPasswordInput.value = "";
  elements.serverChangePasswordInput.value = "";
}

async function createServerUser() {
  try {
    const username = elements.serverNewUsernameInput.value.trim();
    const password = elements.serverNewPasswordInput.value;
    const role = elements.serverNewUserRoleSelect.value;
    const employeeId = elements.serverUserEmployeeSelect.value;

    if (!username || !password || (role === "user" && !employeeId)) {
      setServerStatus("사용자 ID, 비밀번호를 입력하고 일반 유저는 직원을 선택해 주세요.", "error");
      return;
    }

    await serverRequest("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ username, password, role, employeeId })
    });

    elements.serverNewUsernameInput.value = "";
    elements.serverNewPasswordInput.value = "";
    closeServerAccountForms();
    setServerStatus(`${username} ${role === "admin" ? "관리자" : "일반 유저"} 계정을 생성했습니다.`);
    await loadServerUsersAndEmployees();
  } catch (error) {
    setServerStatus(error.message || "계정을 생성하지 못했습니다.", "error");
  }
}

async function changeServerUserPassword() {
  try {
    const userId = elements.serverPasswordUserSelect.value;
    const password = elements.serverChangePasswordInput.value;
    if (!userId || !password) {
      setServerStatus("비밀번호를 변경할 계정과 새 비밀번호를 입력해 주세요.", "error");
      return;
    }
    await serverRequest(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
      method: "POST",
      body: JSON.stringify({ password })
    });
    elements.serverChangePasswordInput.value = "";
    closeServerAccountForms();
    setServerStatus("비밀번호를 변경했습니다.");
  } catch (error) {
    setServerStatus(error.message || "비밀번호를 변경하지 못했습니다.", "error");
  }
}

async function changeServerUserRole(userId) {
  try {
    const roleSelect = elements.serverUsersBody.querySelector(`[data-role-user-id="${userId}"]`);
    const role = roleSelect?.value;
    if (!role) {
      setServerStatus("변경할 권한을 선택해 주세요.", "error");
      return;
    }
    if (!window.confirm(`선택한 계정 권한을 ${role === "admin" ? "관리자" : "일반 유저"}로 변경할까요?`)) {
      await loadServerUsersAndEmployees();
      return;
    }

    await serverRequest(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: "POST",
      body: JSON.stringify({ role })
    });
    setServerStatus(`${role === "admin" ? "관리자" : "일반 유저"} 권한으로 변경했습니다.`);
    await loadServerUsersAndEmployees();
  } catch (error) {
    setServerStatus(error.message || "권한을 변경하지 못했습니다.", "error");
    await loadServerUsersAndEmployees();
  }
}

elements.selectedDateInput.addEventListener("change", () => {
  renderAll();
  loadSelectedRecordIntoForm();
  loadServerMonthlySummary();
});

function moveSelectedMonth(monthOffset) {
  const date = parseLocalDate(elements.selectedDateInput.value);
  const selectedDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + monthOffset);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(selectedDay, lastDay));
  elements.selectedDateInput.value = formatLocalDate(date);
  renderAll();
  loadSelectedRecordIntoForm();
  loadServerMonthlySummary();
}

elements.previousMonthButton.addEventListener("click", () => {
  moveSelectedMonth(-1);
});

elements.nextMonthButton.addEventListener("click", () => {
  moveSelectedMonth(1);
});

elements.adminMyAttendanceToggleButton.addEventListener("click", () => {
  adminOnlyMyAttendance = !adminOnlyMyAttendance;
  elements.adminMyAttendanceToggleButton.textContent = adminOnlyMyAttendance ? "전체 근무 보기" : "내 근태 보기";
  renderCalendar();
});

elements.calendarGrid.addEventListener("click", event => {
  const button = event.target.closest("button[data-date]");
  if (!button) return;
  if (elements.attendanceOffSelect.value === "연차") {
    const date = button.dataset.date;
    if (selectedAnnualLeaveDates.has(date)) {
      selectedAnnualLeaveDates.delete(date);
    } else {
      selectedAnnualLeaveDates.add(date);
    }
    elements.selectedDateInput.value = date;
    updateAnnualLeaveView();
    renderCalendar();
    return;
  }
  elements.selectedDateInput.value = button.dataset.date;
  renderAll();
  loadSelectedRecordIntoForm();
});

elements.calendarGrid.addEventListener("mouseover", event => {
  const tooltipTarget = event.target.closest("[data-tooltip]");
  if (!tooltipTarget || !elements.calendarGrid.contains(tooltipTarget)) return;
  showCalendarTooltip(tooltipTarget.dataset.tooltip, event);
});

elements.calendarGrid.addEventListener("mousemove", event => {
  moveCalendarTooltip(event);
});

elements.calendarGrid.addEventListener("mouseout", event => {
  if (event.relatedTarget && event.target.closest("[data-tooltip]")?.contains(event.relatedTarget)) return;
  hideCalendarTooltip();
});

elements.showOtInputButton.addEventListener("click", () => {
  setInputSectionVisibility("ot");
  loadSelectedRecordIntoForm();
});

elements.showNightInputButton.addEventListener("click", () => {
  setInputSectionVisibility("night");
  loadSelectedRecordIntoForm();
});

elements.showAttendanceInputButton.addEventListener("click", () => {
  setInputSectionVisibility("attendance");
});

elements.recommendButton.addEventListener("click", () => {
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
elements.exportAttendanceCsvButton.addEventListener("click", exportAttendanceCsv);
elements.saveAttendanceButton.addEventListener("click", saveAttendanceRecord);
elements.saveAnnualLeaveButton.addEventListener("click", saveAnnualLeaveRecords);
elements.saveSaturdayOffButton.addEventListener("click", saveSaturdayOff);
elements.resetAttendanceButton.addEventListener("click", () => resetAttendanceForm());
elements.attendanceOtInput.addEventListener("input", syncAttendanceNoteWithOtInputs);
elements.attendanceOtUsedInput.addEventListener("input", syncAttendanceNoteWithOtInputs);
elements.attendanceFlexEarnedInput.addEventListener("input", syncAttendanceNoteWithOtInputs);
elements.attendanceFlexUsedInput.addEventListener("input", syncAttendanceNoteWithOtInputs);
elements.attendanceFlexReasonInput.addEventListener("input", syncAttendanceNoteWithOtInputs);
elements.attendanceManualNoteInput.addEventListener("input", syncAttendanceNoteWithOtInputs);
elements.attendanceNameSelect.addEventListener("change", () => {
  loadAttendanceRecordIntoForm(elements.selectedDateInput.value, elements.attendanceNameSelect.value);
  updateSaturdayOffButtonState();
});
elements.attendanceOffSelect.addEventListener("change", updateAnnualLeaveView);
elements.alternateMriButton.addEventListener("click", () => recommendAlternate("mri"));
elements.alternateXrayButton.addEventListener("click", () => recommendAlternate("xray"));
elements.manualMriSelect.addEventListener("change", () => {
  refreshOtRoleOptions();
});
elements.manualXraySelect.addEventListener("change", () => {
  refreshOtRoleOptions();
});
elements.backupJsonButton.addEventListener("click", backupJson);
elements.restoreJsonButton.addEventListener("click", () => elements.restoreJsonInput.click());
elements.restoreJsonInput.addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) restoreJson(file);
  event.target.value = "";
});

elements.adminGateLoginButton.addEventListener("click", () => {
  loginServerAdmin(elements.adminGateUsernameInput.value.trim(), elements.adminGatePasswordInput.value);
});
elements.adminGatePasswordInput.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  elements.adminGateLoginButton.click();
});
elements.serverLogoutButton.addEventListener("click", logoutServerAdmin);
elements.serverImportButton.addEventListener("click", importLocalBackupToServer);
elements.serverReloadButton.addEventListener("click", reloadServerLatestData);
elements.serverUsersRefreshButton.addEventListener("click", loadServerUsersAndEmployees);
elements.serverCreateUserToggleButton.addEventListener("click", () => openServerAccountForm(elements.serverCreateUserForm));
elements.serverChangePasswordToggleButton.addEventListener("click", () => openServerAccountForm(elements.serverChangePasswordForm));
elements.serverCreateUserCancelButton.addEventListener("click", closeServerAccountForms);
elements.serverChangePasswordCancelButton.addEventListener("click", closeServerAccountForms);
elements.serverCreateUserButton.addEventListener("click", createServerUser);
elements.serverChangePasswordButton.addEventListener("click", changeServerUserPassword);
elements.serverUsersBody.addEventListener("click", event => {
  const button = event.target.closest("button[data-change-role-user-id]");
  if (!button) return;
  changeServerUserRole(button.dataset.changeRoleUserId);
});

document.querySelectorAll("[data-server-tool-section]").forEach(section => {
  section.addEventListener("toggle", () => {
    if (!section.open) return;
    document.querySelectorAll("[data-server-tool-section]").forEach(otherSection => {
      if (otherSection !== section) otherSection.open = false;
    });
  });
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
    mriStartDate: elements.employeeMriStartDateInput.value,
    otStartDate: elements.employeeOtStartDateInput.value,
    nightStartDate: elements.employeeNightStartDateInput.value,
    hireDate: elements.employeeHireDateInput.value,
    retireDate: elements.employeeRetireDateInput.value
  };
  employee.canMri = Boolean(employee.mriStartDate);
  employee.isOtEligible = Boolean(employee.otStartDate);
  employee.isNightEligible = Boolean(employee.nightStartDate);

  if (employee.hireDate && employee.retireDate && employee.hireDate > employee.retireDate) {
    showMessage("퇴사일은 입사일보다 빠를 수 없습니다.", "error");
    return;
  }

  const existingIndex = appData.employees.findIndex(item => item.id === id);
  if (existingIndex >= 0) {
    appData.employees[existingIndex] = employee;
  } else {
    appData.employees.push(employee);
  }

  await saveData();
  resetEmployeeForm();
  setEmployeeFormVisible(false);
  renderAll();
  loadSelectedRecordIntoForm();
  showMessage("직원 정보가 저장되었습니다.");
});

elements.showEmployeeFormButton.addEventListener("click", () => {
  resetEmployeeForm();
  setEmployeeFormVisible(true);
  elements.employeeNameInput.focus();
});
elements.cancelEmployeeEditButton.addEventListener("click", () => {
  resetEmployeeForm();
  setEmployeeFormVisible(false);
});

elements.employeeTableBody.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "move-employee-up") moveEmployee(button.dataset.id, -1);
  if (button.dataset.action === "move-employee-down") moveEmployee(button.dataset.id, 1);
  if (button.dataset.action === "edit-employee") editEmployee(button.dataset.id);
  if (button.dataset.action === "delete-employee") deleteEmployee(button.dataset.id);
});

elements.recordTableBody.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "edit-record") editRecord(button.dataset.date);
  if (button.dataset.action === "delete-record") deleteRecord(button.dataset.date);
});

elements.attendanceTableBody.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "edit-attendance") {
    setInputSectionVisibility("attendance");
    loadAttendanceRecordIntoForm(button.dataset.date, button.dataset.name);
  }
  if (button.dataset.action === "delete-attendance") {
    deleteAttendanceRecord(button.dataset.date, button.dataset.name);
  }
});

async function initialize() {
  try {
    elements.selectedDateInput.value = getTodayText();
    await loadData();
    renderAll();
    loadSelectedRecordIntoForm();
    await checkServerSession();
    showMessage("서버에 로그인하면 최신 데이터가 자동으로 불러와집니다.");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

initialize();
