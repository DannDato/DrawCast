import api from './axios';

export async function getSoundLibrary() {
  const { data } = await api.get('/sounds');
  return Array.isArray(data?.sounds) ? data.sounds.map((sound) => ({ ...sound, scope: sound.scope || 'library' })) : [];
}

export async function getChannelSoundLibrary(channelUuid) {
  if (!channelUuid) return [];
  const { data } = await api.get(`/channels/${channelUuid}/sounds`);
  return Array.isArray(data?.sounds) ? data.sounds.map((sound) => ({ ...sound, scope: 'channel' })) : [];
}

export async function uploadChannelSound(channelUuid, file, onUploadProgress) {
  const form = new FormData();
  form.append('sound', file);
  const { data } = await api.post(`/channels/${channelUuid}/sounds`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress
  });
  return data?.sound || null;
}

export async function deleteChannelSound(channelUuid, soundId) {
  await api.delete(`/channels/${channelUuid}/sounds/${encodeURIComponent(soundId)}`);
}

export function getSoundUrl(soundId, version = null, scope = 'library', publicKey = null) {
  const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
  const query = version ? `?v=${encodeURIComponent(version)}` : '';
  if (scope === 'channel') {
    if (!publicKey) return '';
    return `${base}/sounds/channel/${encodeURIComponent(publicKey)}/${encodeURIComponent(soundId)}${query}`;
  }
  return `${base}/sounds/${encodeURIComponent(soundId)}${query}`;
}
