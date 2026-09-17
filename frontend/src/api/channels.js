import api from './axios';
import { cachedRequest, invalidateRequestCache } from './requestCache';

const CHANNELS_KEY = 'channels:mine';
const collaboratorsKey = (id) => `channels:${id}:collaborators`;

export const getChannels = ({ force = false } = {}) => cachedRequest(
  CHANNELS_KEY,
  () => api.get('/channels/mine').then((response) => response.data),
  { ttl: 2000, force }
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
  return result;
};

export const getCollaborators = (id, { force = false } = {}) => cachedRequest(
  collaboratorsKey(id),
  () => api.get(`/channels/${id}/collaborators`).then((response) => response.data),
  { ttl: 2000, force }
);

export const removeCollaborator = async (id, userId) => {
  const result = await api.delete(`/channels/${id}/collaborators/${userId}`);
  invalidateRequestCache(collaboratorsKey(id));
  return result;
};

export const invalidateChannelCache = () => invalidateRequestCache('channels:');
