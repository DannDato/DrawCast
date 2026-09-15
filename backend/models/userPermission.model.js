import { DataTypes } from 'sequelize';

export default (db) => db.define('UserPermission', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
  permissionKey: { type: DataTypes.STRING(120), allowNull: false, field: 'permission_key' }
}, {
  tableName: 'user_permissions',
  indexes: [
    { unique: true, fields: ['user_id', 'permission_key'] },
    { fields: ['user_id'] },
    { fields: ['permission_key'] }
  ]
});
