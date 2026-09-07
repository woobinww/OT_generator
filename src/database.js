const { existsSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const defaultDataDirectory = path.join(__dirname, "..", "data");
const defaultDatabasePath = path.join(defaultDataDirectory, "work-attendance.sqlite");

function initializeDatabase(databasePath = process.env.DB_PATH || defaultDatabasePath) {
  const databaseDirectory = path.dirname(databasePath);
  if (!existsSync(databaseDirectory)) {
    mkdirSync(databaseDirectory, { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA journal_mode = WAL");
  createTables(database);
  seedSyncMeta(database);
  seedInitialAdmin(database);
  return database;
}

function createTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'calendar_admin', 'user')),
      employee_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      hire_date TEXT,
      retire_date TEXT,
      mri_start_date TEXT,
      ot_start_date TEXT,
      night_start_date TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS work_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      mri_employee_id INTEGER,
      xray_employee_id INTEGER,
      night_mri_employee_id INTEGER,
      night_xray_employee_id INTEGER,
      memo TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mri_employee_id) REFERENCES employees(id),
      FOREIGN KEY (xray_employee_id) REFERENCES employees(id),
      FOREIGN KEY (night_mri_employee_id) REFERENCES employees(id),
      FOREIGN KEY (night_xray_employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS date_memos (
      date TEXT PRIMARY KEY,
      memo TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      employee_id INTEGER NOT NULL,
      ot REAL NOT NULL DEFAULT 0,
      ot_earned REAL NOT NULL DEFAULT 0,
      ot_used REAL NOT NULL DEFAULT 0,
      night_ot REAL NOT NULL DEFAULT 0,
      holiday_ot REAL NOT NULL DEFAULT 0,
      flex_ot REAL NOT NULL DEFAULT 0,
      flex_earned REAL NOT NULL DEFAULT 0,
      flex_used REAL NOT NULL DEFAULT 0,
      flex_reason TEXT NOT NULL DEFAULT '',
      off TEXT NOT NULL DEFAULT '',
      internal_off TEXT NOT NULL DEFAULT '',
      manual_note TEXT NOT NULL DEFAULT '',
      auto_note TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (date, employee_id),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE INDEX IF NOT EXISTS idx_work_records_date ON work_records(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_records_employee ON attendance_records(employee_id);

    CREATE TABLE IF NOT EXISTS sync_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      event_type TEXT NOT NULL,
      actor_user_id INTEGER,
      actor_username TEXT,
      actor_role TEXT,
      target_date TEXT,
      target_employee_id INTEGER,
      details_json TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (actor_user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
  `);
  ensureUserRoleConstraint(database);
  ensureAttendanceRecordColumns(database);
}

function ensureUserRoleConstraint(database) {
  const table = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!table?.sql || table.sql.includes("'calendar_admin'")) return;

  database.exec("PRAGMA foreign_keys = OFF");
  try {
    database.exec("BEGIN");
    database.exec("ALTER TABLE audit_logs RENAME TO audit_logs_legacy_roles");
    database.exec("ALTER TABLE users RENAME TO users_legacy_roles");
    database.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'calendar_admin', 'user')),
        employee_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      );
      INSERT INTO users (id, username, password_hash, role, employee_id, created_at, updated_at)
      SELECT id, username, password_hash, role, employee_id, created_at, updated_at
      FROM users_legacy_roles;

      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        event_type TEXT NOT NULL,
        actor_user_id INTEGER,
        actor_username TEXT,
        actor_role TEXT,
        target_date TEXT,
        target_employee_id INTEGER,
        details_json TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (actor_user_id) REFERENCES users(id)
      );
      INSERT INTO audit_logs (id, created_at, event_type, actor_user_id, actor_username, actor_role, target_date, target_employee_id, details_json)
      SELECT id, created_at, event_type, actor_user_id, actor_username, actor_role, target_date, target_employee_id, details_json
      FROM audit_logs_legacy_roles;
      DROP TABLE audit_logs_legacy_roles;
      DROP TABLE users_legacy_roles;
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
    `);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.exec("PRAGMA foreign_keys = ON");
  }
}

function ensureAttendanceRecordColumns(database) {
  const existingColumns = new Set(
    database.prepare("PRAGMA table_info(attendance_records)").all().map(column => column.name)
  );
  const columns = [
    ["early_ot", "REAL"],
    ["other_ot", "REAL"],
    ["flex_earned", "REAL NOT NULL DEFAULT 0"],
    ["flex_used", "REAL NOT NULL DEFAULT 0"],
    ["flex_reason", "TEXT NOT NULL DEFAULT ''"],
    ["manual_note", "TEXT NOT NULL DEFAULT ''"],
    ["auto_note", "TEXT NOT NULL DEFAULT ''"]
  ];

  columns.forEach(([name, definition]) => {
    if (!existingColumns.has(name)) {
      database.exec(`ALTER TABLE attendance_records ADD COLUMN ${name} ${definition}`);
    }
  });
}

function seedSyncMeta(database) {
  database.prepare(`
    INSERT OR IGNORE INTO sync_meta (id, version)
    VALUES (1, 0)
  `).run();
}

function seedInitialAdmin(database) {
  const existingAdmin = database.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existingAdmin) return;

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin1234";
  const passwordHash = hashPassword(password);

  database.prepare(`
    INSERT INTO users (username, password_hash, role)
    VALUES (?, ?, 'admin')
  `).run(username, passwordHash);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${salt}$${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [algorithm, salt, expectedHash] = String(passwordHash || "").split("$");
  if (algorithm !== "pbkdf2_sha256" || !salt || !expectedHash) return false;

  const actualHash = hashPassword(password, salt).split("$")[2];
  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}

function getSyncVersion(database) {
  const row = database.prepare("SELECT version FROM sync_meta WHERE id = 1").get();
  return Number(row?.version || 0);
}

function writeAuditLog(database, event = {}) {
  const details = event.details && typeof event.details === "object"
    ? JSON.stringify(event.details)
    : "{}";

  database.prepare(`
    INSERT INTO audit_logs (
      event_type,
      actor_user_id,
      actor_username,
      actor_role,
      target_date,
      target_employee_id,
      details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(event.eventType || "unknown"),
    event.actorUserId == null ? null : Number(event.actorUserId),
    event.actorUsername ? String(event.actorUsername) : null,
    event.actorRole ? String(event.actorRole) : null,
    event.targetDate ? String(event.targetDate) : null,
    event.targetEmployeeId == null ? null : Number(event.targetEmployeeId),
    details
  );
}

function getAuditLogs(database, { limit = 100, eventType = "" } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const rows = eventType
    ? database.prepare(`
      SELECT a.id, a.created_at AS createdAt, a.event_type AS eventType,
        a.actor_username AS actorUsername, a.actor_role AS actorRole,
        a.target_date AS targetDate, a.target_employee_id AS targetEmployeeId,
        e.name AS targetEmployeeName, a.details_json AS detailsJson
      FROM audit_logs a
      LEFT JOIN employees e ON e.id = a.target_employee_id
      WHERE a.event_type = ?
      ORDER BY a.id DESC
      LIMIT ?
    `).all(String(eventType), safeLimit)
    : database.prepare(`
      SELECT a.id, a.created_at AS createdAt, a.event_type AS eventType,
        a.actor_username AS actorUsername, a.actor_role AS actorRole,
        a.target_date AS targetDate, a.target_employee_id AS targetEmployeeId,
        e.name AS targetEmployeeName, a.details_json AS detailsJson
      FROM audit_logs a
      LEFT JOIN employees e ON e.id = a.target_employee_id
      ORDER BY a.id DESC
      LIMIT ?
    `).all(safeLimit);

  return rows.map(row => {
    let details = {};
    try {
      details = JSON.parse(row.detailsJson || "{}");
    } catch {
      details = {};
    }
    return {
      id: row.id,
      createdAt: row.createdAt,
      eventType: row.eventType,
      actorUsername: row.actorUsername || "시스템",
      actorRole: row.actorRole || "",
      targetDate: row.targetDate || "",
      targetEmployeeId: row.targetEmployeeId,
      targetEmployeeName: row.targetEmployeeName || "",
      details
    };
  });
}

module.exports = {
  initializeDatabase,
  hashPassword,
  verifyPassword,
  getSyncVersion,
  writeAuditLog,
  getAuditLogs
};
