import api from './axios';

export async function getSystemPermissions() {
  const { data } = await api.get('/admin/system/permissions');
  return data;
}

export async function getSystemUsers(q = '') {
  const { data } = await api.get('/admin/system/users', { params: q ? { q } : undefined });
  return data;
}

export async function saveSystemUserPermissions(userUuid, permissions) {
  const { data } = await api.patch(`/admin/system/users/${encodeURIComponent(userUuid)}/permissions`, { permissions });
  return data;
}

export async function getSystemCollaborators(q = '') {
  const { data } = await api.get('/admin/system/collaborators', { params: q ? { q } : undefined });
  return data;
}

export async function grantSystemCollabLicense(userUuid) {
  const { data } = await api.post(`/admin/system/collaborators/${encodeURIComponent(userUuid)}/license`);
  return data;
}

export async function revokeSystemCollabLicense(userUuid) {
  const { data } = await api.delete(`/admin/system/collaborators/${encodeURIComponent(userUuid)}/license`);
  return data;
}
