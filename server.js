const { createServer } = require("node:http");
const { createApp } = require("./src/server-app");
const { initializeDatabase } = require("./src/database");

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

const database = initializeDatabase();
const app = createApp({ database });

const server = createServer(app);

server.listen(port, host, () => {
  console.log(`영상의학과 근무·근태 관리 서버 실행 중: http://localhost:${port}`);
});
