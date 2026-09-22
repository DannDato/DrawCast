import { DataTypes } from 'sequelize';

export default (db) => db.define('ChannelUserPreference', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
  channelId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'channel_id' },
  isFavorite: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_favorite' },
  lastUsedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_used_at' }
}, {
  tableName: 'channel_user_preferences',
  indexes: [
    { unique: true, fields: ['user_id', 'channel_id'] },
    { name: 'channel_user_preferences_user_last_used_idx', fields: ['user_id', 'last_used_at'] }
  ]
});
