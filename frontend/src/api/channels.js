import api from './axios';
import { cachedRequest, invalidateRequestCache } from './requestCache';

const CHANNELS_KEY = 'channels:mine';
const FEATURED_KEY = 'channels:featured';
const INVITATIONS_KEY = 'channels:invitations:pending';
const collaboratorsKey = (id) => `channels:${id}:collaborators`;

export const getChannels = ({ force = false } = {}) => cachedRequest(
  CHANNELS_KEY,
  () => api.get('/channels/mine').then((response) => response.data),
  { ttl: 2000, force }
);

export const getFeaturedChannel = ({ force = false } = {}) => cachedRequest(
  FEATURED_KEY,
  () => api.get('/channels/featured').then((response) => response.data),
  { ttl: 300000, force }
);

export const createChannel = async (data) => {
  const result = await api.post('/channels', data).then((response) => response.data);
  invalidateRequestCache('channels:');
  return result;
};

export const updateChannel = async (id, data) => {
  const result = await api.patch(`/channels/${id}`, data).then((response) => response.data);
  invalidateRequestCache('channels:');
  return result;
};

export const inviteCollaborator = async (id, email) => {
  const result = await api.post(`/channels/${id}/invitations`, { email }).then((response) => response.data);
  invalidateRequestCache(collaboratorsKey(id));
  return result;
};

export const acceptInvitation = async (token) => {
  const result = await api.post('/channels/invitations/accept', { token }).then((response) => response.data);
  invalidateRequestCache('channels:');
  invalidateRequestCache(INVITATIONS_KEY);
  return result;
};


export const getPendingInvitations = ({ force = false } = {}) => cachedRequest(
  INVITATIONS_KEY,
  () => api.get('/channels/invitations/pending').then((response) => response.data),
  { ttl: 15000, force }
);

export const acceptPendingInvitation = async (invitationId) => {
  const result = await api.post(`/channels/invitations/${invitationId}/accept`).then((response) => response.data);
  invalidateRequestCache(INVITATIONS_KEY);
  invalidateRequestCache(CHANNELS_KEY);
  return result;
};

export const rejectPendingInvitation = async (invitationId) => {
  const result = await api.post(`/channels/invitations/${invitationId}/reject`).then((response) => response.data);
  invalidateRequestCache(INVITATIONS_KEY);
  return result;
};

export const notifyInvitationsChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('drawcast:invitations-changed'));
};

export const getCollaborators = (id, { force = false } = {}) => cachedRequest(
  collaboratorsKey(id),
  () => api.get(`/channels/${id}/collaborators`).then((response) => response.data),
  { ttl: 2000, force }
);

export const setCollaboratorAccess = async (id, userId, canEdit) => {
  const result = await api.patch(`/channels/${id}/collaborators/${userId}`, { canEdit }).then((response) => response.data);
  invalidateRequestCache(collaboratorsKey(id));
  invalidateRequestCache(CHANNELS_KEY);
  return result;
};

export const removeCollaborator = async (id, userId) => {
  const result = await api.delete(`/channels/${id}/collaborators/${userId}`);
  invalidateRequestCache(collaboratorsKey(id));
  invalidateRequestCache(CHANNELS_KEY);
  return result;
};

export const invalidateChannelCache = () => invalidateRequestCache('channels:');


export const deleteChannel = async (id, confirmation) => {
  const result = await api.delete(`/channels/${id}`, { data: { confirmation } });
  invalidateRequestCache('channels:');
  return result;
};

export const leaveChannel = async (id) => {
  const result = await api.delete(`/channels/${id}/collaboration`);
  invalidateRequestCache('channels:');
  return result;
};
