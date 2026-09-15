import api from './axios';
export const getChannels = () => api.get('/channels/mine').then(r => r.data);
export const createChannel = (data) => api.post('/channels', data).then(r => r.data);
export const updateChannel = (id, data) => api.patch(`/channels/${id}`, data).then(r => r.data);
export const inviteCollaborator = (id, email) => api.post(`/channels/${id}/invitations`, { email }).then(r => r.data);
export const acceptInvitation = (token) => api.post('/channels/invitations/accept', { token }).then(r => r.data);
export const getCollaborators = (id) => api.get(`/channels/${id}/collaborators`).then(r => r.data);
export const removeCollaborator = (id, userId) => api.delete(`/channels/${id}/collaborators/${userId}`);
