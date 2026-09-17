import api from './axios';

export const getSavedDesigns = (channelId) => api.get(`/channels/${channelId}/designs`).then((response) => response.data);
export const getSavedDesign = (channelId, designId) => api.get(`/channels/${channelId}/designs/${designId}`).then((response) => response.data);
export const createSavedDesign = (channelId, data) => api.post(`/channels/${channelId}/designs`, data).then((response) => response.data);
export const updateSavedDesign = (channelId, designId, data) => api.patch(`/channels/${channelId}/designs/${designId}`, data).then((response) => response.data);
export const deleteSavedDesign = (channelId, designId) => api.delete(`/channels/${channelId}/designs/${designId}`);
