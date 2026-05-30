import winston from "winston";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, "../logs");

if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });

const { combine, timestamp, printf, colorize } = winston.format;

const fmt = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase().padEnd(5)}] ${message}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(timestamp({ format: "HH:mm:ss.SSS" }), fmt),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: "HH:mm:ss.SSS" }), fmt),
    }),
    ...(process.env.LOG_TO_FILE === "true"
      ? [
          new winston.transports.File({
            filename: path.join(logsDir, "polybot.log"),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
            tailable: true,
          }),
          new winston.transports.File({
            filename: path.join(logsDir, "trades.log"),
            level: "info",
            maxsize: 10 * 1024 * 1024,
            maxFiles: 10,
          }),
        ]
      : []),
  ],
});

export default logger;
