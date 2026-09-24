import { DataTypes } from 'sequelize';

export default (db) => db.define('LicenseAssignment', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
  licenseId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'license_id' },
  channelId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'channel_id' },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'ACTIVE' },
  assignedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'assigned_at' },
  releasedAt: { type: DataTypes.DATE, allowNull: true, field: 'released_at' },
  metadata: { type: DataTypes.JSON, allowNull: true }
}, {
  tableName: 'license_assignments',
  indexes: [
    { fields: ['license_id', 'status'] },
    { fields: ['channel_id', 'status'] }
  ]
});
