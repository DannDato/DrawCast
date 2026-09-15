import { DataTypes } from 'sequelize';

export default (db) => db.define('OtpChallenge', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
  codeHash: { type: DataTypes.STRING(255), allowNull: false, field: 'code_hash' },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  maxAttempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 5, field: 'max_attempts' },
  resendCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'resend_count' },
  lastSentAt: { type: DataTypes.DATE, allowNull: false, field: 'last_sent_at' },
  consumedAt: { type: DataTypes.DATE, allowNull: true, field: 'consumed_at' },
  ip: { type: DataTypes.STRING(64), allowNull: true },
  userAgent: { type: DataTypes.STRING(500), allowNull: true, field: 'user_agent' }
}, {
  tableName: 'auth_otp_challenges',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['expires_at'] },
    { fields: ['consumed_at'] }
  ]
});
