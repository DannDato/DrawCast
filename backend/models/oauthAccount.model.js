import { DataTypes } from 'sequelize';
export default (db) => db.define('OAuthAccount', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true }, userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  provider: { type: DataTypes.STRING(40), allowNull: false }, providerUserId: { type: DataTypes.STRING(191), allowNull: false }, email: { type: DataTypes.STRING(191) }, avatarUrl: { type: DataTypes.TEXT }, active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'oauth_accounts', indexes: [{ unique: true, fields: ['provider','provider_user_id'] }] });
