import { DataTypes } from 'sequelize';

export default (db) => db.define('ChannelEntitlement', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  channelId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'channel_id' },
  bundleId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'bundle_id' },
  sourceType: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'admin', field: 'source_type' },
  sourceRef: { type: DataTypes.STRING(160), allowNull: true, field: 'source_ref' },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'ACTIVE' },
  startsAt: { type: DataTypes.DATE, allowNull: true, field: 'starts_at' },
  endsAt: { type: DataTypes.DATE, allowNull: true, field: 'ends_at' },
  metadata: { type: DataTypes.JSON, allowNull: true }
}, {
  tableName: 'channel_entitlements',
  indexes: [
    { fields: ['channel_id', 'status'] },
    { fields: ['bundle_id', 'status'] },
    { fields: ['source_type', 'source_ref'] }
  ]
});
