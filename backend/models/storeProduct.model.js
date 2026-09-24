import { DataTypes } from 'sequelize';

export default (db) => db.define('StoreProduct', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
  key: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  kind: { type: DataTypes.STRING(32), allowNull: false },
  targetScope: { type: DataTypes.STRING(24), allowNull: false, field: 'target_scope' },
  name: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.STRING(320), allowNull: true },
  priceCents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'price_cents' },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },
  billingInterval: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'month', field: 'billing_interval' },
  badge: { type: DataTypes.STRING(80), allowNull: true },
  featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
  metadata: { type: DataTypes.JSON, allowNull: true }
}, {
  tableName: 'store_products',
  indexes: [
    { fields: ['active', 'sort_order'] },
    { fields: ['kind', 'active'] },
    { fields: ['target_scope', 'active'] }
  ]
});
