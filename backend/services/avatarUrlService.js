import { r2RelativeKeyFromPublicUrl } from './r2StorageService.js';

const appFolder = process.env.APP_FOLDER || '/api';

export function publicAvatarUrl(user) {
  const raw = String(user?.avatarUrl || '').trim();
  if (!raw) return null;
  if (!r2RelativeKeyFromPublicUrl(raw)) return raw;
  const version = user?.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
  return `${appFolder}/user/users/${encodeURIComponent(user.uuid)}/avatar?v=${version}`;
}
