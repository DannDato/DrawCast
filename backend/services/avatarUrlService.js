const appFolder = process.env.APP_FOLDER || '/api';

export function publicAvatarUrl(user) {
  const raw = String(user?.avatarUrl || '').trim();
  if (!raw || !user?.uuid) return null;
  const version = user?.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
  return `${appFolder}/user/users/${encodeURIComponent(user.uuid)}/avatar?v=${version}`;
}
