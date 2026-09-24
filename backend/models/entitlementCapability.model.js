import { DataTypes } from 'sequelize';

export default (db) => db.define('EntitlementCapability', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  key: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  scope: { type: DataTypes.STRING(24), allowNull: false },
  valueType: { type: DataTypes.STRING(24), allowNull: false, field: 'value_type' },
  category: { type: DataTypes.STRING(40), allowNull: false },
  name: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.STRING(255), allowNull: true },
  expandable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  hardMin: { type: DataTypes.INTEGER, allowNull: true, field: 'hard_min' },
  hardMax: { type: DataTypes.INTEGER, allowNull: true, field: 'hard_max' },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  metadata: { type: DataTypes.JSON, allowNull: true }
}, {
  tableName: 'entitlement_capabilities',
  indexes: [
    { fields: ['scope', 'active'] },
    { fields: ['category', 'sort_order'] }
  ]
});
