import api from './axios';

export async function getSystemModules() {
  const { data } = await api.get('/system/modules');
  return data.modules || {};
}
