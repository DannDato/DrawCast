import { Sequelize } from 'sequelize';
import '../config/env.js';

const commonOptions = {
  dialect: 'mysql',
  logging: false,
  define: { timestamps: true, underscored: true },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
};

const db = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS || '', {
  ...commonOptions,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306)
});

const hasAuditDatabase = Boolean(process.env.AUDIT_DB_NAME);

const auditDb = hasAuditDatabase ? new Sequelize(
  process.env.AUDIT_DB_NAME,
  process.env.AUDIT_DB_USER || process.env.DB_USER,
  process.env.AUDIT_DB_PASS || '',
  {
    ...commonOptions,
    host: process.env.AUDIT_DB_HOST || process.env.DB_HOST,
    port: Number(process.env.AUDIT_DB_PORT || process.env.DB_PORT || 3306),
    pool: { max: 5, min: 0, acquire: 15000, idle: 10000 }
  }
) : db;

export { auditDb, hasAuditDatabase };
export default db;
