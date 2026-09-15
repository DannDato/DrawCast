import { DataTypes } from 'sequelize';
export default (db) => db.define('ChannelInvitation', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  channelId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'channel_id' },
  invitedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'invited_by' },
  email: { type: DataTypes.STRING(191), allowNull: false },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'token_hash' },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  acceptedAt: { type: DataTypes.DATE, allowNull: true, field: 'accepted_at' },
  revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' }
}, { tableName: 'channel_invitations' });
