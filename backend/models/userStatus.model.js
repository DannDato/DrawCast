import { DataTypes } from 'sequelize';
export default (db) => db.define('UserStatus', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  key: { type: DataTypes.STRING(60), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.STRING(255), allowNull: true },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, { tableName: 'user_statuses' });
