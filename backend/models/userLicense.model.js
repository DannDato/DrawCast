import { DataTypes } from 'sequelize';

export default (db) => db.define('UserLicense', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
  productId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'product_id' },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'PENDING' },
  quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  sourceType: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'manual', field: 'source_type' },
  externalRef: { type: DataTypes.STRING(191), allowNull: true, field: 'external_ref' },
  startsAt: { type: DataTypes.DATE, allowNull: true, field: 'starts_at' },
  currentPeriodStart: { type: DataTypes.DATE, allowNull: true, field: 'current_period_start' },
  currentPeriodEnd: { type: DataTypes.DATE, allowNull: true, field: 'current_period_end' },
  cancelAtPeriodEnd: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'cancel_at_period_end' },
  canceledAt: { type: DataTypes.DATE, allowNull: true, field: 'canceled_at' },
  endsAt: { type: DataTypes.DATE, allowNull: true, field: 'ends_at' },
  metadata: { type: DataTypes.JSON, allowNull: true }
}, {
  tableName: 'user_licenses',
  indexes: [
    { fields: ['user_id', 'status'] },
    { fields: ['product_id', 'status'] },
    { fields: ['source_type', 'external_ref'] }
  ]
});
