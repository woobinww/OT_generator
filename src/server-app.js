const { createReadStream, existsSync } = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { hashPassword, verifyPassword, getSyncVersion } = require("./database");
const { importLocalData } = require("./migration");

const publicDirectory = path.join(__dirname, "..", "public");
const sessions = new Map();
const integrationKey = process.env.INTEGRATION_KEY || "local-integration-key";

function createApp({ database }) {
  return async function app(request, response) {
    try {
      const url = new URL(request.url, "http://localhost");

      if (url.pathname.startsWith("/api/")) {
        await handleApiRequest({ request, response, url, database });
        return;
      }

      serveStaticFile(url.pathname, response);
    } catch (error) {
      console.error(error);
      const statusCode = Number(error.statusCode || error.status || 500);
      const payload = { error: error.message || "서버 오류가 발생했습니다." };
      if (error.latestVersion !== undefined) {
        payload.latestVersion = error.latestVersion;
      }
      sendJson(response, statusCode, payload);
    }
  };
}

async function handleApiRequest({ request, response, url, database }) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/integration/attendance") {
    if (!requireIntegrationKey(request, response, url)) return;

    const month = getRequestedMonth(url);
    sendJson(response, 200, {
      month,
      rows: getIntegrationAttendanceRows(database, month)
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/integration/attendance.csv") {
    if (!requireIntegrationKey(request, response, url)) return;

    const month = getRequestedMonth(url);
    const rows = getIntegrationAttendanceRows(database, month);
    sendCsv(response, `attendance-${month}.csv`, buildAttendanceCsv(rows));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJsonBody(request);
    const user = database.prepare("SELECT id, username, password_hash, role, employee_id FROM users WHERE username = ?").get(body.username || "");

    if (!user || !verifyPassword(body.password || "", user.password_hash)) {
      sendJson(response, 401, { error: "아이디 또는 비밀번호가 올바르지 않습니다." });
      return;
    }

    const sessionId = crypto.randomBytes(24).toString("hex");
    sessions.set(sessionId, {
      userId: user.id,
      username: user.username,
      role: user.role,
      employeeId: user.employee_id || null
    });

    response.setHeader("Set-Cookie", buildSessionCookie(sessionId));
    sendJson(response, 200, { user: serializeUser(user) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const sessionId = getSessionId(request);
    if (sessionId) sessions.delete(sessionId);
    response.setHeader("Set-Cookie", "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/password") {
    const session = requireSession(request, response);
    if (!session) return;

    const body = await readJsonBody(request);
    updateOwnPassword(database, session.userId, body.currentPassword, body.newPassword);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    const session = requireSession(request, response);
    if (!session) return;
    sendJson(response, 200, { user: session });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/calendar") {
    const session = requireSession(request, response);
    if (!session) return;

    const month = url.searchParams.get("month") || getCurrentMonth();
    sendJson(response, 200, { month, viewerEmployeeId: session.employeeId ? String(session.employeeId) : "", data: getCalendarData(database, month) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/monthly-summary") {
    const session = requireRole(request, response, "admin");
    if (!session) return;

    const month = url.searchParams.get("month") || getCurrentMonth();
    sendJson(response, 200, { month, rows: getMonthlySummary(database, month) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/employees") {
    const session = requireRole(request, response, "admin");
    if (!session) return;

    sendJson(response, 200, { employees: getEmployees(database) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/data") {
    const session = requireRole(request, response, "admin");
    if (!session) return;

    sendJson(response, 200, { data: getFullData(database), version: getSyncVersion(database) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/users") {
    const session = requireRole(request, response, "admin");
    if (!session) return;

    sendJson(response, 200, { users: getUsers(database) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/sync-state") {
    const session = requireRole(request, response, "admin");
    if (!session) return;

    sendJson(response, 200, { version: getSyncVersion(database) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/users") {
    const session = requireRole(request, response, "admin");
    if (!session) return;

    const body = await readJsonBody(request);
    const user = createUser(database, body);
    sendJson(response, 201, { user });
    return;
  }

  const passwordChangeMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)\/password$/);
  if (request.method === "POST" && passwordChangeMatch) {
    const session = requireRole(request, response, "admin");
    if (!session) return;

    const body = await readJsonBody(request);
    updateUserPassword(database, Number(passwordChangeMatch[1]), body.password);
    sendJson(response, 200, { ok: true });
    return;
  }

  const roleChangeMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)\/role$/);
  if (request.method === "POST" && roleChangeMatch) {
    const session = requireRole(request, response, "admin");
    if (!session) return;

    const body = await readJsonBody(request);
    updateUserRole(database, Number(roleChangeMatch[1]), body.role, session.userId);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/calendar") {
    const session = requireRole(request, response, "admin");
    if (!session) return;

    const month = url.searchParams.get("month") || getCurrentMonth();
    sendJson(response, 200, { month, data: getCalendarData(database, month) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/import-local-data") {
    const session = requireRole(request, response, "admin");
    if (!session) return;

    const body = await readJsonBody(request);
    const replace = url.searchParams.get("replace") === "true";
    const localData = body && typeof body === "object" && body.data ? body.data : body;
    const summary = importLocalData(database, localData, {
      replace,
      expectedVersion: body && typeof body === "object" ? body.baseVersion : null
    });
    sendJson(response, 200, { ok: true, summary });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/me/monthly-summary") {
    const session = requireSession(request, response);
    if (!session) return;
    if (!session.employeeId) {
      sendJson(response, 400, { error: "사용자와 연결된 직원 정보가 없습니다." });
      return;
    }

    const month = url.searchParams.get("month") || getCurrentMonth();
    const rows = getMonthlySummary(database, month, session.employeeId);
    sendJson(response, 200, { month, summary: rows[0] || null });
    return;
  }

  sendJson(response, 404, { error: "API 경로를 찾을 수 없습니다." });
}

function getMonthlySummary(database, month, employeeId = null) {
  const params = [`${month}-%`];
  const employeeFilter = employeeId ? "AND e.id = ?" : "";
  if (employeeId) params.push(employeeId);

  return database.prepare(`
    SELECT
      e.id AS employeeId,
      e.name AS name,
      COALESCE(SUM(a.ot_earned + a.holiday_ot + a.ot_used), 0) AS totalOt,
      COALESCE(SUM(a.ot_earned), 0) AS otEarned,
      COALESCE(SUM(a.ot_used), 0) AS otUsed,
      COALESCE(SUM(a.night_ot), 0) AS nightOt,
      COALESCE(SUM(a.holiday_ot), 0) AS holidayOt,
      COALESCE(SUM(a.flex_ot), 0) AS flexOt,
      SUM(CASE WHEN a.off = '연차' THEN 1 ELSE 0 END) AS annualLeaveCount,
      SUM(CASE WHEN a.off = '오전반차' THEN 1 ELSE 0 END) AS morningHalfCount,
      SUM(CASE WHEN a.off = '오후반차' THEN 1 ELSE 0 END) AS afternoonHalfCount
    FROM employees e
    LEFT JOIN attendance_records a ON a.employee_id = e.id AND a.date LIKE ?
    WHERE 1 = 1 ${employeeFilter}
    GROUP BY e.id, e.name
    ORDER BY e.display_order ASC, e.id ASC
  `).all(...params);
}

function getIntegrationAttendanceRows(database, month) {
  return database.prepare(`
    SELECT
      a.date,
      e.name,
      a.ot,
      a.night_ot AS nightOt,
      a.holiday_ot AS holidayOt,
      a.flex_ot AS flexOt,
      CASE
        WHEN a.internal_off = '토요일OFF' THEN ''
        WHEN a.off = '토요일OFF' THEN ''
        ELSE a.off
      END AS off,
      a.note
    FROM attendance_records a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.date LIKE ?
      AND NOT (
        (a.internal_off = '토요일OFF' OR a.off = '토요일OFF')
        AND a.ot = 0
        AND a.night_ot = 0
        AND a.holiday_ot = 0
        AND a.flex_ot = 0
        AND a.note = ''
      )
    ORDER BY a.date ASC, e.display_order ASC, e.id ASC
  `).all(`${month}-%`).map(row => ({
    date: row.date,
    name: row.name,
    ot: normalizeNumber(row.ot),
    nightOt: normalizeNumber(row.nightOt),
    holidayOt: normalizeNumber(row.holidayOt),
    flexOt: normalizeNumber(row.flexOt),
    off: row.off || "",
    note: row.note || ""
  }));
}

function getEmployees(database) {
  return database.prepare(`
    SELECT
      id,
      name,
      display_order AS displayOrder,
      hire_date AS hireDate,
      retire_date AS retireDate
    FROM employees
    ORDER BY display_order ASC, id ASC
  `).all();
}

function getUsers(database) {
  return database.prepare(`
    SELECT
      u.id,
      u.username,
      u.role,
      u.employee_id AS employeeId,
      e.name AS employeeName
    FROM users u
    LEFT JOIN employees e ON e.id = u.employee_id
    ORDER BY u.role ASC, u.username ASC
  `).all();
}

function createUser(database, body) {
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const role = body.role === "admin" ? "admin" : "user";
  const employeeId = body.employeeId ? Number(body.employeeId) : null;

  if (!username) {
    throw new Error("사용자 ID를 입력해 주세요.");
  }
  if (!password) {
    throw new Error("비밀번호를 입력해 주세요.");
  }
  if (role === "user" && !employeeId) {
    throw new Error("일반 유저는 연결할 직원을 선택해야 합니다.");
  }
  if (employeeId) {
    const employee = database.prepare("SELECT id FROM employees WHERE id = ?").get(employeeId);
    if (!employee) {
      throw new Error("선택한 직원을 찾을 수 없습니다.");
    }
  }

  try {
    const result = database.prepare(`
      INSERT INTO users (username, password_hash, role, employee_id)
      VALUES (?, ?, ?, ?)
    `).run(username, hashPassword(password), role, employeeId);

    return {
      id: Number(result.lastInsertRowid),
      username,
      role,
      employeeId
    };
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      throw new Error("이미 사용 중인 사용자 ID입니다.");
    }
    throw error;
  }
}

function updateUserPassword(database, userId, password) {
  if (!password) {
    throw new Error("새 비밀번호를 입력해 주세요.");
  }

  const result = database.prepare(`
    UPDATE users
    SET password_hash = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(hashPassword(password), userId);

  if (!result.changes) {
    throw new Error("사용자 계정을 찾을 수 없습니다.");
  }
}

function updateUserRole(database, userId, role, currentAdminUserId) {
  if (!["admin", "user"].includes(role)) {
    throw new Error("변경할 권한을 올바르게 선택해 주세요.");
  }

  const user = database.prepare("SELECT id, role, employee_id FROM users WHERE id = ?").get(userId);
  if (!user) {
    throw new Error("사용자 계정을 찾을 수 없습니다.");
  }
  if (user.id === currentAdminUserId && role !== "admin") {
    throw new Error("현재 로그인한 관리자 본인의 권한은 변경할 수 없습니다.");
  }
  if (role === "user" && !user.employee_id) {
    throw new Error("일반 유저 권한을 사용하려면 먼저 직원과 연결된 계정이어야 합니다.");
  }

  database.prepare(`
    UPDATE users
    SET role = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(role, userId);

  for (const session of sessions.values()) {
    if (session.userId === userId) {
      session.role = role;
    }
  }
}

function updateOwnPassword(database, userId, currentPassword, newPassword) {
  if (!currentPassword) {
    throw new Error("현재 비밀번호를 입력해 주세요.");
  }
  if (!newPassword) {
    throw new Error("새 비밀번호를 입력해 주세요.");
  }

  const user = database.prepare("SELECT id, password_hash FROM users WHERE id = ?").get(userId);
  if (!user) {
    throw new Error("사용자 계정을 찾을 수 없습니다.");
  }

  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw new Error("현재 비밀번호가 올바르지 않습니다.");
  }

  database.prepare(`
    UPDATE users
    SET password_hash = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(hashPassword(newPassword), userId);
}

function getCalendarData(database, month) {
  const data = getFullData(database);
  return {
    ...data,
    records: data.records.filter(record => record.date.startsWith(`${month}-`)),
    attendanceRecords: data.attendanceRecords.filter(record => record.date.startsWith(`${month}-`))
  };
}

function getFullData(database) {
  const employees = database.prepare(`
    SELECT
      id,
      name,
      hire_date AS hireDate,
      retire_date AS retireDate,
      mri_start_date AS mriStartDate,
      ot_start_date AS otStartDate,
      night_start_date AS nightStartDate
    FROM employees
    ORDER BY display_order ASC, id ASC
  `).all().map(employee => ({
    id: String(employee.id),
    name: employee.name,
    hireDate: employee.hireDate || "",
    retireDate: employee.retireDate || "",
    mriStartDate: employee.mriStartDate || "",
    otStartDate: employee.otStartDate || "",
    nightStartDate: employee.nightStartDate || "",
    canMri: Boolean(employee.mriStartDate),
    isOtEligible: Boolean(employee.otStartDate),
    isNightEligible: Boolean(employee.nightStartDate)
  }));

  const records = database.prepare(`
    SELECT
      date,
      mri_employee_id AS mriEmployeeId,
      xray_employee_id AS xrayEmployeeId,
      night_mri_employee_id AS nightMriEmployeeId,
      night_xray_employee_id AS nightXrayEmployeeId,
      memo
    FROM work_records
    ORDER BY date ASC
  `).all().map(record => ({
    date: record.date,
    needsOt: Boolean(record.mriEmployeeId && record.xrayEmployeeId),
    mriEmployeeId: record.mriEmployeeId ? String(record.mriEmployeeId) : "",
    xrayEmployeeId: record.xrayEmployeeId ? String(record.xrayEmployeeId) : "",
    nightMriEmployeeId: record.nightMriEmployeeId ? String(record.nightMriEmployeeId) : "",
    nightXrayEmployeeId: record.nightXrayEmployeeId ? String(record.nightXrayEmployeeId) : "",
    memo: record.memo || ""
  }));

  const attendanceRecords = database.prepare(`
    SELECT
      a.date,
      e.id AS employeeId,
      e.name,
      a.ot,
      a.ot_earned AS otEarned,
      a.ot_used AS otUsed,
      a.night_ot AS nightOt,
      a.holiday_ot AS holidayOt,
      a.flex_ot AS flexOt,
      CASE WHEN a.internal_off = '토요일OFF' THEN '토요일OFF' ELSE a.off END AS off,
      a.note
    FROM attendance_records a
    JOIN employees e ON e.id = a.employee_id
    ORDER BY a.date ASC, e.display_order ASC, e.id ASC
  `).all();

  return {
    employees,
    records,
    attendanceRecords,
    exceptions: [],
    settings: {}
  };
}

function serveStaticFile(pathname, response) {
  const safePathname = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDirectory, safePathname));

  if (!filePath.startsWith(publicDirectory) || !existsSync(filePath)) {
    sendText(response, 404, "파일을 찾을 수 없습니다.");
    return;
  }

  response.writeHead(200, {
    "Content-Type": getContentType(filePath),
    "Cache-Control": "no-store"
  });
  createReadStream(filePath).pipe(response);
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    employeeId: user.employee_id || null
  };
}

function requireRole(request, response, role) {
  const session = requireSession(request, response);
  if (!session) return null;
  if (session.role !== role) {
    sendJson(response, 403, { error: "권한이 없습니다." });
    return null;
  }
  return session;
}

function requireSession(request, response) {
  const sessionId = getSessionId(request);
  const session = sessionId ? sessions.get(sessionId) : null;
  if (!session) {
    sendJson(response, 401, { error: "로그인이 필요합니다." });
    return null;
  }
  return session;
}

function requireIntegrationKey(request, response, url) {
  const requestKey = request.headers["x-integration-key"] || url.searchParams.get("key") || "";
  if (String(requestKey) !== integrationKey) {
    sendJson(response, 401, { error: "연동키가 올바르지 않습니다." });
    return false;
  }
  return true;
}

function getRequestedMonth(url) {
  const month = url.searchParams.get("month") || getCurrentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    const error = new Error("month는 YYYY-MM 형식으로 입력해 주세요.");
    error.statusCode = 400;
    throw error;
  }
  return month;
}

function getSessionId(request) {
  const cookie = request.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function buildSessionCookie(sessionId) {
  return `session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString("utf-8");
  if (!rawBody) return {};
  return JSON.parse(rawBody);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendCsv(response, fileName, csv) {
  response.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`
  });
  response.end(`\ufeff${csv}`);
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
}

function buildAttendanceCsv(rows) {
  const header = ["date", "name", "ot", "nightOt", "holidayOt", "flexOt", "off", "note"];
  const values = rows.map(row => header.map(key => row[key]));
  return [header, ...values].map(row => row.map(escapeCsvValue).join(",")).join("\n");
}

function escapeCsvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function normalizeNumber(value) {
  const number = Number(value || 0);
  if (number === 0) return "";
  return Number.isInteger(number) ? number : number;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

module.exports = { createApp };
