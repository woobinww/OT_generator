const { appendFileSync, existsSync, mkdirSync } = require("node:fs");
const path = require("node:path");

const defaultLogDirectory = path.join(__dirname, "..", "logs");

function createLogger(logDirectory = process.env.LOG_DIR || defaultLogDirectory) {
  if (!existsSync(logDirectory)) {
    mkdirSync(logDirectory, { recursive: true });
  }

  function write(level, event, details = {}) {
    try {
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const entry = {
        time: now.toISOString(),
        level,
        event,
        ...details
      };
      const fileName = `${level}-${date}.log`;
      appendFileSync(path.join(logDirectory, fileName), `${JSON.stringify(entry)}\n`, "utf8");
    } catch (error) {
      console.error("로그 파일 기록 실패:", error.message);
    }
  }

  return {
    access(details) {
      write("access", "http_request", details);
    },
    error(details) {
      write("error", "server_error", details);
    },
    info(event, details) {
      write("info", event, details);
    }
  };
}

module.exports = { createLogger };
