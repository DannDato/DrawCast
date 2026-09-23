import db, { auditDb } from '../config/database.js';
import UserFactory from './user.model.js';
import RoleFactory from './role.model.js';
import PermissionFactory from './permission.model.js';
import UserPermissionFactory from './userPermission.model.js';
import PresetPermissionFactory from './presetPermission.model.js';
import SessionFactory from './session.model.js';
import UserStatusFactory from './userStatus.model.js';
import OAuthFactory from './oauthAccount.model.js';
import AuditFactory from './auditLog.model.js';
import IpFactory from './ipCache.model.js';
import ResetFactory from './passwordReset.model.js';
import SettingFactory from './systemSetting.model.js';
import OtpChallengeFactory from './otpChallenge.model.js';
import TrustedDeviceFactory from './trustedDevice.model.js';
import EmailChangeFactory from './emailChange.model.js';
import AuthThrottleFactory from './authThrottle.model.js';
import ChannelFactory from './channel.model.js';
import ChannelGuideFactory from './channelGuide.model.js';
import ChannelCollaboratorFactory from './channelCollaborator.model.js';
import ChannelInvitationFactory from './channelInvitation.model.js';
import SavedDesignFactory from './savedDesign.model.js';
import UserSettingFactory from './userSetting.model.js';
import ChannelUserPreferenceFactory from './channelUserPreference.model.js';

const models = {
  User: UserFactory(db),
  Role: RoleFactory(db),
  Permission: PermissionFactory(db),
  UserPermission: UserPermissionFactory(db),
  PresetPermission: PresetPermissionFactory(db),
  Session: SessionFactory(db),
  UserStatus: UserStatusFactory(db),
  OAuthAccount: OAuthFactory(db),
  PasswordReset: ResetFactory(db),
  SystemSetting: SettingFactory(db),
  OtpChallenge: OtpChallengeFactory(db),
  TrustedDevice: TrustedDeviceFactory(db),
  EmailChange: EmailChangeFactory(db),
  AuthThrottle: AuthThrottleFactory(db),
  Channel: ChannelFactory(db),
  ChannelGuide: ChannelGuideFactory(db),
  ChannelCollaborator: ChannelCollaboratorFactory(db),
  ChannelInvitation: ChannelInvitationFactory(db),
  SavedDesign: SavedDesignFactory(db),
  UserSetting: UserSettingFactory(db),
  ChannelUserPreference: ChannelUserPreferenceFactory(db),
  AuditLog: AuditFactory(auditDb),
  IpCache: IpFactory(auditDb)
};

models.User.belongsTo(models.Role, { foreignKey: 'roleKey', targetKey: 'key', as: 'role', constraints: false });
models.Role.hasMany(models.User, { foreignKey: 'roleKey', sourceKey: 'key', as: 'users', constraints: false });

models.User.hasMany(models.UserPermission, { foreignKey: 'userId', as: 'permissionLinks', onDelete: 'CASCADE' });
models.UserPermission.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
models.UserPermission.belongsTo(models.Permission, { foreignKey: 'permissionKey', targetKey: 'key', as: 'permissionRef', constraints: false });
models.Permission.hasMany(models.UserPermission, { foreignKey: 'permissionKey', sourceKey: 'key', as: 'userLinks', constraints: false });

models.Role.hasMany(models.PresetPermission, { foreignKey: 'roleKey', sourceKey: 'key', as: 'presetPermissions', constraints: false });
models.PresetPermission.belongsTo(models.Role, { foreignKey: 'roleKey', targetKey: 'key', as: 'role', constraints: false });
models.PresetPermission.belongsTo(models.Permission, { foreignKey: 'permissionKey', targetKey: 'key', as: 'permissionRef', constraints: false });
models.Permission.hasMany(models.PresetPermission, { foreignKey: 'permissionKey', sourceKey: 'key', as: 'presetLinks', constraints: false });

models.User.belongsTo(models.UserStatus, { foreignKey: 'statusKey', targetKey: 'key', as: 'statusRef', constraints: false });
models.UserStatus.hasMany(models.User, { foreignKey: 'statusKey', sourceKey: 'key', as: 'users', constraints: false });
models.User.hasMany(models.Session, { foreignKey: 'userId', as: 'sessions' });
models.User.hasMany(models.OAuthAccount, { foreignKey: 'userId', as: 'oauthAccounts' });
models.User.hasMany(models.OtpChallenge, { foreignKey: 'userId', as: 'otpChallenges', onDelete: 'CASCADE' });
models.OtpChallenge.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
models.User.hasMany(models.TrustedDevice, { foreignKey: 'userId', as: 'trustedDevices', onDelete: 'CASCADE' });
models.TrustedDevice.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
models.User.hasMany(models.EmailChange, { foreignKey: 'userId', as: 'emailChanges', onDelete: 'CASCADE' });
models.EmailChange.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });

models.User.hasMany(models.UserSetting, { foreignKey: 'userId', as: 'settings', onDelete: 'CASCADE' });
models.UserSetting.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
models.User.hasMany(models.ChannelUserPreference, { foreignKey: 'userId', as: 'channelPreferences', onDelete: 'CASCADE' });
models.ChannelUserPreference.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });

models.User.hasMany(models.Channel, { foreignKey: 'ownerId', as: 'ownedChannels', onDelete: 'CASCADE' });
models.Channel.belongsTo(models.User, { foreignKey: 'ownerId', as: 'owner' });
models.Channel.hasMany(models.ChannelUserPreference, { foreignKey: 'channelId', as: 'userPreferences', onDelete: 'CASCADE' });
models.ChannelUserPreference.belongsTo(models.Channel, { foreignKey: 'channelId', as: 'channel' });
models.Channel.hasMany(models.ChannelCollaborator, { foreignKey: 'channelId', as: 'collaborators', onDelete: 'CASCADE' });
models.ChannelCollaborator.belongsTo(models.Channel, { foreignKey: 'channelId', as: 'channel' });
models.ChannelCollaborator.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
models.Channel.hasMany(models.ChannelInvitation, { foreignKey: 'channelId', as: 'invitations', onDelete: 'CASCADE' });
models.ChannelInvitation.belongsTo(models.Channel, { foreignKey: 'channelId', as: 'channel' });
models.ChannelInvitation.belongsTo(models.User, { foreignKey: 'invitedBy', as: 'inviter' });
models.Channel.hasMany(models.SavedDesign, { foreignKey: 'channelId', as: 'savedDesigns', onDelete: 'CASCADE' });
models.SavedDesign.belongsTo(models.Channel, { foreignKey: 'channelId', as: 'channel' });
models.User.hasMany(models.SavedDesign, { foreignKey: 'createdBy', as: 'savedDesigns', onDelete: 'CASCADE' });
models.SavedDesign.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });

models.Channel.hasMany(models.ChannelGuide, { foreignKey: 'channelId', as: 'guides', onDelete: 'CASCADE' });
models.ChannelGuide.belongsTo(models.Channel, { foreignKey: 'channelId', as: 'channel' });

export { db, auditDb, models };
