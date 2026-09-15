import { DataTypes } from 'sequelize';
export default (db) => db.define('RolePermission', { roleId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true }, permissionId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true } }, { tableName: 'role_permissions', timestamps: false });
