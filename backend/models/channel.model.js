import { DataTypes } from 'sequelize';
export default (db) => db.define('Channel', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  ownerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true, field: 'owner_id' },
  name: { type: DataTypes.STRING(120), allowNull: false },
  platform: { type: DataTypes.STRING(40), allowNull: true },
  channelUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'channel_url' },
  publicKey: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'public_key' }
}, { tableName: 'channels' });
