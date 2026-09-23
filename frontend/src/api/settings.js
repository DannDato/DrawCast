import api from './axios';
import { cachedRequest, invalidateRequestCache } from './requestCache';

const SETTINGS_KEY = 'user:settings';

export const getUserSettings = ({ force = false } = {}) => cachedRequest(
  SETTINGS_KEY,
  () => api.get('/user/settings').then((response) => response.data),
  { ttl: 5000, force }
);

export async function saveEditorSettings(editor) {
  const { data } = await api.patch('/user/settings/editor', editor);
  invalidateRequestCache(SETTINGS_KEY);
  return data;
}

export async function saveSoundSlots(slots) {
  const { data } = await api.patch('/user/settings/sounds', { slots });
  invalidateRequestCache(SETTINGS_KEY);
  return Array.isArray(data?.soundSlots) ? data.soundSlots : [];
}

export async function saveLaunchpadSlots(slots) {
  const { data } = await api.patch('/user/settings/launchpad', { slots });
  invalidateRequestCache(SETTINGS_KEY);
  return Array.isArray(data?.launchpadSlots) ? data.launchpadSlots : [];
}

export async function resetEditorSettings() {
  const { data } = await api.delete('/user/settings/editor');
  invalidateRequestCache(SETTINGS_KEY);
  return data;
}

export const invalidateSettingsCache = () => invalidateRequestCache(SETTINGS_KEY);
