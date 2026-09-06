const { createServer } = require("node:http");
const { createApp } = require("./src/server-app");
const { initializeDatabase } = require("./src/database");
const { createLogger } = require("./src/logger");
const { createBackupManager } = require("./src/backup");

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

const database = initializeDatabase();
const logger = createLogger();
const backups = createBackupManager(database);
try {
  backups.createBackup("startup");
} catch (error) {
  logger.error({ event: "backup.startup_failed", message: error.message });
}
const app = createApp({ database, logger, backupManager: backups });

function scheduleDailyBackup() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(() => {
    try { backups.createBackup("daily"); }
    catch (error) { logger.error({ event: "backup.daily_failed", message: error.message }); }
    scheduleDailyBackup();
  }, next - now).unref();
}
scheduleDailyBackup();

const server = createServer(app);

server.listen(port, host, () => {
  console.log(`영상의학과 근무·근태 관리 서버 실행 중: http://localhost:${port}`);
  logger.info("server.started", { host, port, pid: process.pid });
});
