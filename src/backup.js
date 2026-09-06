const { existsSync, mkdirSync, readdirSync, unlinkSync } = require("node:fs");
const path = require("node:path");

const defaultBackupDirectory = path.join(__dirname, "..", "data", "backups");
const DEFAULT_RETENTION = 30;

function createBackupManager(database, options = {}) {
  const directory = options.directory || process.env.BACKUP_DIR || defaultBackupDirectory;
  const retention = Number(options.retention || process.env.BACKUP_RETENTION || DEFAULT_RETENTION);
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });

  function createBackup(reason = "manual") {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const safeReason = String(reason).replace(/[^a-zA-Z0-9_-]/g, "_");
    const target = path.join(directory, `work-attendance-${stamp}-${safeReason}.sqlite`);
    const escaped = target.replaceAll("'", "''");
    database.exec(`VACUUM INTO '${escaped}'`);
    prune();
    return { fileName: path.basename(target), path: target };
  }

  function listBackups() {
    if (!existsSync(directory)) return [];
    return readdirSync(directory)
      .filter(name => /^work-attendance-.*\.sqlite$/.test(name))
      .map(fileName => ({ fileName, path: path.join(directory, fileName) }))
      .sort((a, b) => b.fileName.localeCompare(a.fileName));
  }

  function prune() {
    const backups = listBackups();
    backups.slice(Math.max(0, retention)).forEach(item => unlinkSync(item.path));
  }

  return { createBackup, listBackups, prune };
}

module.exports = { createBackupManager };
