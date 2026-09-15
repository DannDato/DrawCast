import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';
import path from 'path';

const logDir = process.env.LOG_DIR || 'logs';
fs.mkdirSync(logDir, { recursive: true });

const redact = winston.format((info) => {
  const forbidden = /password|passwd|authorization|cookie|token|secret|credential/i;
  const scrub = (value) => {
    if (!value || typeof value !== 'object') return value;
    for (const key of Object.keys(value)) {
      if (forbidden.test(key)) value[key] = '[REDACTED]';
      else if (value[key] && typeof value[key] === 'object') scrub(value[key]);
    }
    return value;
  };
  return scrub(info);
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(redact(), winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
  transports: [
    new DailyRotateFile({ filename: path.join(logDir, 'combined-%DATE%.log'), datePattern: 'YYYY-MM-DD', maxFiles: '14d', zippedArchive: true }),
    new DailyRotateFile({ filename: path.join(logDir, 'error-%DATE%.log'), datePattern: 'YYYY-MM-DD', level: 'error', maxFiles: '30d', zippedArchive: true })
  ]
});
if (process.env.NODE_ENV !== 'production') logger.add(new winston.transports.Console({ format: winston.format.combine(winston.format.colorize(), winston.format.simple()) }));
export default logger;
