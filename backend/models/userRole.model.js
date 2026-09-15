import { DataTypes } from 'sequelize';
export default (db) => db.define('UserRole', { userId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true }, roleId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true } }, { tableName: 'user_roles', timestamps: false });
