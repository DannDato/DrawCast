import { DataTypes } from 'sequelize';

export default (db) => db.define('RegistrationInvite', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'token_hash' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'created_by' },
  usedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'used_by' },
  usedAt: { type: DataTypes.DATE, allowNull: true, field: 'used_at' },
  revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' }
}, {
  tableName: 'registration_invites',
  updatedAt: false,
  indexes: [
    { name: 'registration_invites_created_by', fields: ['created_by'] },
    { name: 'registration_invites_used_by', fields: ['used_by'] }
  ]
});
