import { DataTypes } from 'sequelize';

export default (db) => db.define('PresetPermission', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  roleKey: { type: DataTypes.STRING(80), allowNull: false, field: 'role_key' },
  permissionKey: { type: DataTypes.STRING(120), allowNull: false, field: 'permission_key' },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: 'preset_permissions',
  indexes: [
    { unique: true, fields: ['role_key', 'permission_key'] },
    { fields: ['role_key'] },
    { fields: ['permission_key'] }
  ]
});
