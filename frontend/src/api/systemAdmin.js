import api from './axios';

export async function getSystemPresence() {
  const { data } = await api.get('/admin/system/presence');
  return data;
}

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

export async function getAdminSystemModules() {
  const { data } = await api.get('/admin/system/modules');
  return data.modules || {};
}

export async function setAdminSystemModule(moduleKey, enabled) {
  const { data } = await api.patch(`/admin/system/modules/${encodeURIComponent(moduleKey)}`, { enabled });
  return data.module;
}


export async function getRegistrationInvites() {
  const { data } = await api.get('/admin/system/registration-invites');
  return data.invites || [];
}

export async function createRegistrationInvite() {
  const { data } = await api.post('/admin/system/registration-invites');
  return data.invite;
}

export async function revokeRegistrationInvite(inviteUuid) {
  const { data } = await api.delete(`/admin/system/registration-invites/${encodeURIComponent(inviteUuid)}`);
  return data;
}

export async function getSystemCatalog() {
  const { data } = await api.get('/admin/system/catalog');
  return data;
}

export async function createSystemCatalogProduct(payload) {
  const { data } = await api.post('/admin/system/catalog/products', payload);
  return data.product;
}

export async function saveSystemCatalogProduct(productUuid, payload) {
  const { data } = await api.patch(`/admin/system/catalog/products/${encodeURIComponent(productUuid)}`, payload);
  return data.product;
}

export async function disableSystemCatalogProduct(productUuid) {
  const { data } = await api.delete(`/admin/system/catalog/products/${encodeURIComponent(productUuid)}`);
  return data;
}
