import { DataTypes } from 'sequelize';

export default (db) => db.define('StoreProductRequirement', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  productId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'product_id' },
  groupKey: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'default', field: 'group_key' },
  subjectType: { type: DataTypes.STRING(24), allowNull: false, field: 'subject_type' },
  subjectKey: { type: DataTypes.STRING(120), allowNull: false, field: 'subject_key' },
  operator: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'active' },
  value: { type: DataTypes.JSON, allowNull: true },
  description: { type: DataTypes.STRING(220), allowNull: true }
}, {
  tableName: 'store_product_requirements',
  timestamps: false,
  indexes: [
    { fields: ['product_id', 'group_key'] },
    { fields: ['subject_type', 'subject_key'] }
  ]
});
