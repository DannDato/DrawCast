import { DataTypes } from 'sequelize';

export default (db) => db.define('StoreOrder', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'PENDING' },
  currency: { type: DataTypes.STRING(3), allowNull: false },
  itemCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'item_count' },
  subtotalCents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'subtotal_cents' },
  totalCents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'total_cents' },
  paymentProvider: { type: DataTypes.STRING(64), allowNull: true, field: 'payment_provider' },
  paymentRef: { type: DataTypes.STRING(191), allowNull: true, field: 'payment_ref' },
  paidAt: { type: DataTypes.DATE, allowNull: true, field: 'paid_at' },
  metadata: { type: DataTypes.JSON, allowNull: true }
}, {
  tableName: 'store_orders',
  indexes: [
    { fields: ['user_id', 'created_at'] },
    { fields: ['user_id', 'status'] },
    { fields: ['status', 'created_at'] },
    { unique: true, fields: ['payment_provider', 'payment_ref'] }
  ]
});
