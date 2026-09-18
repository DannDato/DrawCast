import { DataTypes } from 'sequelize';

export default (db) => db.define('UserSetting', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
  key: { type: DataTypes.STRING(120), allowNull: false },
  value: { type: DataTypes.TEXT('long'), allowNull: false }
}, {
  tableName: 'user_settings',
  indexes: [{ unique: true, fields: ['user_id', 'key'] }]
});
