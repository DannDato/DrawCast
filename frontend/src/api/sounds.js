import api from './axios';

export async function getSoundLibrary() {
  const { data } = await api.get('/sounds');
  return Array.isArray(data?.sounds) ? data.sounds : [];
}

export function getSoundUrl(soundId, version = null) {
  const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
  const query = version ? `?v=${encodeURIComponent(version)}` : '';
  return `${base}/sounds/${encodeURIComponent(soundId)}${query}`;
}
