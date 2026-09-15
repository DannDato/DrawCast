import { DataTypes } from 'sequelize';

export default (db) => db.define('TrustedDevice', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'token_hash' },
  ip: { type: DataTypes.STRING(64), allowNull: true },
  userAgent: { type: DataTypes.STRING(500), allowNull: true, field: 'user_agent' },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  lastUsedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_used_at' },
  revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' }
}, {
  tableName: 'trusted_devices',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['expires_at'] },
    { fields: ['revoked_at'] }
  ]
});
