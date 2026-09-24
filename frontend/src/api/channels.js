import api from './axios';
import { cachedRequest, invalidateRequestCache } from './requestCache';

const CHANNELS_KEY = 'channels:mine';
const FEATURED_KEY = 'channels:featured';
const INVITATIONS_KEY = 'channels:invitations:pending';
const collaboratorsKey = (channelUuid) => `channels:${channelUuid}:collaborators`;
const entitlementsKey = (channelUuid) => `channels:${channelUuid}:entitlements`;

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


export const getChannelEntitlements = (channelUuid, { force = false } = {}) => cachedRequest(
  entitlementsKey(channelUuid),
  () => api.get(`/channels/${channelUuid}/entitlements`).then((response) => response.data),
  { ttl: 3000, force }
);

export const createChannel = async (data) => {
  const result = await api.post('/channels', data).then((response) => response.data);
  invalidateRequestCache('channels:');
  return result;
};

export const updateChannel = async (channelUuid, data) => {
  const result = await api.patch(`/channels/${channelUuid}`, data).then((response) => response.data);
  invalidateRequestCache('channels:');
  return result;
};

export const inviteCollaborator = async (channelUuid, email) => {
  const result = await api.post(`/channels/${channelUuid}/invitations`, { email }).then((response) => response.data);
  invalidateRequestCache(collaboratorsKey(channelUuid));
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

export const acceptPendingInvitation = async (invitationUuid) => {
  const result = await api.post(`/channels/invitations/${invitationUuid}/accept`).then((response) => response.data);
  invalidateRequestCache(INVITATIONS_KEY);
  invalidateRequestCache(CHANNELS_KEY);
  return result;
};

export const rejectPendingInvitation = async (invitationUuid) => {
  const result = await api.post(`/channels/invitations/${invitationUuid}/reject`).then((response) => response.data);
  invalidateRequestCache(INVITATIONS_KEY);
  return result;
};

export const notifyInvitationsChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('TRAZIO:invitations-changed'));
};

export const getCollaborators = (channelUuid, { force = false } = {}) => cachedRequest(
  collaboratorsKey(channelUuid),
  () => api.get(`/channels/${channelUuid}/collaborators`).then((response) => response.data),
  { ttl: 2000, force }
);

export const setCollaboratorAccess = async (channelUuid, userUuid, canEdit) => {
  const result = await api.patch(`/channels/${channelUuid}/collaborators/${userUuid}`, { canEdit }).then((response) => response.data);
  invalidateRequestCache(collaboratorsKey(channelUuid));
  invalidateRequestCache(CHANNELS_KEY);
  return result;
};

export const removeCollaborator = async (channelUuid, userUuid) => {
  const result = await api.delete(`/channels/${channelUuid}/collaborators/${userUuid}`);
  invalidateRequestCache(collaboratorsKey(channelUuid));
  invalidateRequestCache(CHANNELS_KEY);
  return result;
};

export const invalidateChannelCache = () => invalidateRequestCache('channels:');

export const deleteChannel = async (channelUuid, confirmation) => {
  const result = await api.delete(`/channels/${channelUuid}`, { data: { confirmation } });
  invalidateRequestCache('channels:');
  return result;
};

export const leaveChannel = async (channelUuid) => {
  const result = await api.delete(`/channels/${channelUuid}/collaboration`);
  invalidateRequestCache('channels:');
  return result;
};

export const setChannelFavorite = async (channelUuid, isFavorite) => {
  const result = await api.patch(`/channels/${channelUuid}/preference`, { isFavorite }).then((response) => response.data);
  invalidateRequestCache(CHANNELS_KEY);
  return result;
};

export const markChannelUsed = async (channelUuid) => {
  const result = await api.post(`/channels/${channelUuid}/usage`).then((response) => response.data);
  invalidateRequestCache(CHANNELS_KEY);
  return result;
};
