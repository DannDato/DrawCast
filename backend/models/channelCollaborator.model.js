import { DataTypes } from 'sequelize';
export default (db) => db.define('ChannelCollaborator', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  channelId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'channel_id' },
  userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
  invitedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'invited_by' },
  canEdit: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'can_edit' }
}, { tableName: 'channel_collaborators', indexes: [{ unique: true, fields: ['channel_id', 'user_id'] }] });
