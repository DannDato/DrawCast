import { DataTypes } from 'sequelize';
export default (db) => db.define('SystemSetting', { key: { type: DataTypes.STRING(120), primaryKey: true }, value: { type: DataTypes.TEXT }, description: DataTypes.STRING(255), public: { type: DataTypes.BOOLEAN, defaultValue: false } }, { tableName: 'system_settings' });
