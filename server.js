const { createServer } = require("node:http");
const { createApp } = require("./src/server-app");
const { initializeDatabase } = require("./src/database");
const { createLogger } = require("./src/logger");

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

const database = initializeDatabase();
const logger = createLogger();
const app = createApp({ database, logger });

const server = createServer(app);

server.listen(port, host, () => {
  console.log(`영상의학과 근무·근태 관리 서버 실행 중: http://localhost:${port}`);
  logger.info("server.started", { host, port, pid: process.pid });
});
