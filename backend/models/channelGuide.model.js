import { DataTypes } from 'sequelize';

export default (db) => db.define('ChannelGuide', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  channelId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'channel_id' },
  slot: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, validate: { min: 1, max: 3 } },
  name: { type: DataTypes.STRING(120), allowNull: false },
  imageData: { type: DataTypes.TEXT('long'), allowNull: false, field: 'image_data' },
  sizeBytes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'size_bytes' }
}, {
  tableName: 'channel_guides',
  indexes: [{ unique: true, fields: ['channel_id', 'slot'] }]
});
