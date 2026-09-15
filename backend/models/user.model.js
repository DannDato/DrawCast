import { DataTypes } from 'sequelize';

export default (db) => db.define('User', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  email: { type: DataTypes.STRING(191), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(255), allowNull: true, field: 'password_hash' },
  displayName: { type: DataTypes.STRING(120), allowNull: true, field: 'display_name' },
  avatarUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'avatar_url' },
  roleKey: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'USER', field: 'role_key' },
  statusKey: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'ACTIVE', field: 'status_key' },
  emailVerifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'email_verified_at' }
}, { tableName: 'users' });
