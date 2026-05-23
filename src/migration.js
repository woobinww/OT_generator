function importLocalData(database, localData, options = {}) {
  validateLocalData(localData);
  const expectedVersion = Number.isFinite(Number(options.expectedVersion))
    ? Number(options.expectedVersion)
    : null;

  const employeeIdMap = new Map();
  const summary = {
    employees: 0,
    workRecords: 0,
    attendanceRecords: 0,
    deletedWorkRecords: 0,
    deletedAttendanceRecords: 0,
    deletedEmployees: 0,
    version: 0
  };

  database.exec("BEGIN IMMEDIATE");
  try {
    const currentVersion = getSyncVersion(database);
    if (expectedVersion !== null && expectedVersion !== currentVersion) {
      const error = new Error("서버 데이터가 다른 PC에서 먼저 변경되었습니다. 서버에서 다시 불러온 뒤 다시 저장해 주세요.");
      error.statusCode = 409;
      error.latestVersion = currentVersion;
      throw error;
    }

    if (options.replace) {
      const deleteSummary = deleteMissingRows(database, localData);
      summary.deletedWorkRecords = deleteSummary.deletedWorkRecords;
      summary.deletedAttendanceRecords = deleteSummary.deletedAttendanceRecords;
      summary.deletedEmployees = deleteSummary.deletedEmployees;
    }

    localData.employees.forEach((employee, index) => {
      const employeeId = upsertEmployee(database, employee, index);
      employeeIdMap.set(employee.id, employeeId);
      employeeIdMap.set(employee.name, employeeId);
      summary.employees += 1;
    });

    localData.records.forEach(record => {
      upsertWorkRecord(database, record, employeeIdMap);
      summary.workRecords += 1;
    });

    localData.attendanceRecords.forEach(record => {
      const employeeId = employeeIdMap.get(record.name);
      if (!employeeId) return;
      upsertAttendanceRecord(database, record, employeeId);
      summary.attendanceRecords += 1;
    });

    const nextVersion = currentVersion + 1;
    database.prepare(`
      UPDATE sync_meta
      SET version = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(nextVersion);
    summary.version = nextVersion;

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return summary;
}

function deleteMissingRows(database, localData) {
  const employeeNames = new Set(localData.employees.map(employee => employee.name).filter(Boolean));
  const recordDates = new Set(localData.records.map(record => record.date).filter(Boolean));
  const attendanceKeys = new Set(localData.attendanceRecords
    .filter(record => record.date && record.name)
    .map(record => `${record.date}|${record.name}`));

  let deletedWorkRecords = 0;
  let deletedAttendanceRecords = 0;
  let deletedEmployees = 0;

  const existingAttendanceRecords = database.prepare(`
    SELECT a.date, e.name
    FROM attendance_records a
    JOIN employees e ON e.id = a.employee_id
  `).all();

  existingAttendanceRecords.forEach(record => {
    if (attendanceKeys.has(`${record.date}|${record.name}`)) return;
    const result = database.prepare(`
      DELETE FROM attendance_records
      WHERE date = ? AND employee_id = (SELECT id FROM employees WHERE name = ?)
    `).run(record.date, record.name);
    deletedAttendanceRecords += Number(result.changes || 0);
  });

  const existingWorkRecords = database.prepare("SELECT date FROM work_records").all();
  existingWorkRecords.forEach(record => {
    if (recordDates.has(record.date)) return;
    const result = database.prepare("DELETE FROM work_records WHERE date = ?").run(record.date);
    deletedWorkRecords += Number(result.changes || 0);
  });

  const existingEmployees = database.prepare("SELECT id, name FROM employees").all();
  existingEmployees.forEach(employee => {
    if (employeeNames.has(employee.name)) return;
    database.prepare(`
      UPDATE work_records
      SET mri_employee_id = CASE WHEN mri_employee_id = ? THEN NULL ELSE mri_employee_id END,
          xray_employee_id = CASE WHEN xray_employee_id = ? THEN NULL ELSE xray_employee_id END,
          night_mri_employee_id = CASE WHEN night_mri_employee_id = ? THEN NULL ELSE night_mri_employee_id END,
          night_xray_employee_id = CASE WHEN night_xray_employee_id = ? THEN NULL ELSE night_xray_employee_id END
    `).run(employee.id, employee.id, employee.id, employee.id);
    database.prepare("UPDATE users SET employee_id = NULL WHERE employee_id = ?").run(employee.id);
    database.prepare("DELETE FROM attendance_records WHERE employee_id = ?").run(employee.id);
    const result = database.prepare("DELETE FROM employees WHERE id = ?").run(employee.id);
    deletedEmployees += Number(result.changes || 0);
  });

  return { deletedWorkRecords, deletedAttendanceRecords, deletedEmployees };
}

function validateLocalData(localData) {
  if (!localData || typeof localData !== "object") {
    throw new Error("가져올 JSON 데이터 구조가 올바르지 않습니다.");
  }
  if (!Array.isArray(localData.employees)) {
    throw new Error("employees 배열이 필요합니다.");
  }
  if (!Array.isArray(localData.records)) {
    throw new Error("records 배열이 필요합니다.");
  }
  if (!Array.isArray(localData.attendanceRecords)) {
    localData.attendanceRecords = [];
  }
}

function getSyncVersion(database) {
  const row = database.prepare("SELECT version FROM sync_meta WHERE id = 1").get();
  return Number(row?.version || 0);
}

function upsertEmployee(database, employee, index) {
  const normalizedEmployee = {
    name: employee.name || "",
    displayOrder: index,
    hireDate: employee.hireDate || "",
    retireDate: employee.retireDate || "",
    mriStartDate: employee.mriStartDate || (employee.canMri ? employee.hireDate || "1900-01-01" : ""),
    otStartDate: employee.otStartDate || (employee.isOtEligible !== false ? employee.hireDate || "1900-01-01" : ""),
    nightStartDate: employee.nightStartDate || (employee.isNightEligible !== false ? employee.hireDate || "1900-01-01" : "")
  };

  if (!normalizedEmployee.name) {
    throw new Error("이름이 없는 직원 데이터가 있습니다.");
  }

  const existingEmployee = database.prepare("SELECT id FROM employees WHERE name = ?").get(normalizedEmployee.name);

  if (existingEmployee) {
    database.prepare(`
      UPDATE employees
      SET display_order = ?,
          hire_date = NULLIF(?, ''),
          retire_date = NULLIF(?, ''),
          mri_start_date = NULLIF(?, ''),
          ot_start_date = NULLIF(?, ''),
          night_start_date = NULLIF(?, ''),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      normalizedEmployee.displayOrder,
      normalizedEmployee.hireDate,
      normalizedEmployee.retireDate,
      normalizedEmployee.mriStartDate,
      normalizedEmployee.otStartDate,
      normalizedEmployee.nightStartDate,
      existingEmployee.id
    );
    return existingEmployee.id;
  }

  const result = database.prepare(`
    INSERT INTO employees (
      name,
      display_order,
      hire_date,
      retire_date,
      mri_start_date,
      ot_start_date,
      night_start_date
    )
    VALUES (?, ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''))
  `).run(
    normalizedEmployee.name,
    normalizedEmployee.displayOrder,
    normalizedEmployee.hireDate,
    normalizedEmployee.retireDate,
    normalizedEmployee.mriStartDate,
    normalizedEmployee.otStartDate,
    normalizedEmployee.nightStartDate
  );

  return Number(result.lastInsertRowid);
}

function upsertWorkRecord(database, record, employeeIdMap) {
  const date = record.date || "";
  if (!date) return;

  const mriEmployeeId = record.needsOt ? employeeIdMap.get(record.mriEmployeeId) || null : null;
  const xrayEmployeeId = record.needsOt ? employeeIdMap.get(record.xrayEmployeeId) || null : null;
  const nightMriEmployeeId = employeeIdMap.get(record.nightMriEmployeeId) || null;
  const nightXrayEmployeeId = employeeIdMap.get(record.nightXrayEmployeeId) || null;

  database.prepare(`
    INSERT INTO work_records (
      date,
      mri_employee_id,
      xray_employee_id,
      night_mri_employee_id,
      night_xray_employee_id,
      memo
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      mri_employee_id = excluded.mri_employee_id,
      xray_employee_id = excluded.xray_employee_id,
      night_mri_employee_id = excluded.night_mri_employee_id,
      night_xray_employee_id = excluded.night_xray_employee_id,
      memo = excluded.memo,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    date,
    mriEmployeeId,
    xrayEmployeeId,
    nightMriEmployeeId,
    nightXrayEmployeeId,
    record.memo || ""
  );
}

function upsertAttendanceRecord(database, record, employeeId) {
  const date = record.date || "";
  if (!date) return;

  const otParts = getOtParts(record);
  const ot = otParts.otEarned + otParts.otUsed;
  const internalOff = record.off === "토요일OFF" ? "토요일OFF" : "";
  const exportOff = record.off === "토요일OFF" ? "" : record.off || "";

  database.prepare(`
    INSERT INTO attendance_records (
      date,
      employee_id,
      ot,
      ot_earned,
      ot_used,
      night_ot,
      holiday_ot,
      flex_ot,
      off,
      internal_off,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, employee_id) DO UPDATE SET
      ot = excluded.ot,
      ot_earned = excluded.ot_earned,
      ot_used = excluded.ot_used,
      night_ot = excluded.night_ot,
      holiday_ot = excluded.holiday_ot,
      flex_ot = excluded.flex_ot,
      off = excluded.off,
      internal_off = excluded.internal_off,
      note = excluded.note,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    date,
    employeeId,
    ot,
    otParts.otEarned,
    otParts.otUsed,
    toNumberOrZero(record.nightOt),
    toNumberOrZero(record.holidayOt),
    toNumberOrZero(record.flexOt),
    exportOff,
    internalOff,
    record.note || ""
  );
}

function getOtParts(record) {
  const legacyOt = toNumberOrZero(record.ot);
  const hasStoredParts = record.otEarned !== undefined || record.otUsed !== undefined;

  if (hasStoredParts) {
    return {
      otEarned: toNumberOrZero(record.otEarned),
      otUsed: normalizeOtUsedValue(record.otUsed)
    };
  }

  return {
    otEarned: legacyOt > 0 ? legacyOt : 0,
    otUsed: legacyOt < 0 ? legacyOt : 0
  };
}

function normalizeOtUsedValue(value) {
  const numberValue = toNumberOrZero(value);
  if (numberValue === 0) return 0;
  return -Math.abs(numberValue);
}

function toNumberOrZero(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

module.exports = { importLocalData };
