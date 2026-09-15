import { DataTypes } from 'sequelize';
export default (db) => db.define('Session', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true }, userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true }, ip: { type: DataTypes.STRING(64) }, userAgent: { type: DataTypes.STRING(500) },
  expiresAt: { type: DataTypes.DATE, allowNull: false }, revokedAt: { type: DataTypes.DATE, allowNull: true }, lastSeenAt: { type: DataTypes.DATE, allowNull: true }
}, { tableName: 'sessions' });
