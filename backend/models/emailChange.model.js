import { DataTypes } from 'sequelize';

export default (db) => db.define('EmailChange', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
  newEmail: { type: DataTypes.STRING(191), allowNull: false, field: 'new_email' },
  codeHash: { type: DataTypes.STRING(255), allowNull: false, field: 'code_hash' },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  consumedAt: { type: DataTypes.DATE, allowNull: true, field: 'consumed_at' }
}, { tableName: 'email_changes', indexes: [{ fields: ['user_id'] }, { fields: ['expires_at'] }] });
