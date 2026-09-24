import { DataTypes } from 'sequelize';

export default (db) => db.define('StoreProductBundle', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  productId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'product_id' },
  bundleId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'bundle_id' }
}, {
  tableName: 'store_product_bundles',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['product_id', 'bundle_id'] },
    { fields: ['bundle_id'] }
  ]
});
