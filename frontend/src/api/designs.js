import api from './axios';

export const getSavedDesigns = (channelUuid) => api.get(`/channels/${channelUuid}/designs`).then((response) => response.data);
export const getSavedDesign = (channelUuid, designUuid) => api.get(`/channels/${channelUuid}/designs/${designUuid}`).then((response) => response.data);
export const createSavedDesign = (channelUuid, data) => api.post(`/channels/${channelUuid}/designs`, data).then((response) => response.data);
export const updateSavedDesign = (channelUuid, designUuid, data) => api.patch(`/channels/${channelUuid}/designs/${designUuid}`, data).then((response) => response.data);
export const deleteSavedDesign = (channelUuid, designUuid) => api.delete(`/channels/${channelUuid}/designs/${designUuid}`);
