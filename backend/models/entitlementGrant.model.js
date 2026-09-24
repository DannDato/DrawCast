import { DataTypes } from 'sequelize';

export default (db) => db.define('EntitlementGrant', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  bundleId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'bundle_id' },
  capabilityId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'capability_id' },
  operation: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'set' },
  value: { type: DataTypes.JSON, allowNull: false }
}, {
  tableName: 'entitlement_grants',
  indexes: [
    { unique: true, fields: ['bundle_id', 'capability_id'] },
    { fields: ['capability_id'] }
  ]
});
