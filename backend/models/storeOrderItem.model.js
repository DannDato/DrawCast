import { DataTypes } from 'sequelize';

export default (db) => db.define('StoreOrderItem', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
  orderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'order_id' },
  productId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'product_id' },
  productUuid: { type: DataTypes.UUID, allowNull: false, field: 'product_uuid' },
  productKey: { type: DataTypes.STRING(120), allowNull: false, field: 'product_key' },
  productName: { type: DataTypes.STRING(120), allowNull: false, field: 'product_name' },
  priceCents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'price_cents' },
  currency: { type: DataTypes.STRING(3), allowNull: false },
  quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  totalCents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'total_cents' },
  productSnapshot: { type: DataTypes.JSON, allowNull: false, field: 'product_snapshot' }
}, {
  tableName: 'store_order_items',
  indexes: [
    { fields: ['order_id'] },
    { fields: ['product_id'] },
    { fields: ['product_uuid'] },
    { fields: ['product_key'] }
  ]
});
