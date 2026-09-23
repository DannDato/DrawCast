import api from './axios';

export const getChannelGuides = (channelUuid) => api.get(`/channels/${channelUuid}/guides`).then((response) => response.data);
export const getChannelGuide = (channelUuid, slot) => api.get(`/channels/${channelUuid}/guides/${slot}`).then((response) => response.data);
export const saveChannelGuide = (channelUuid, slot, data) => api.put(`/channels/${channelUuid}/guides/${slot}`, data).then((response) => response.data);
export const deleteChannelGuide = (channelUuid, slot) => api.delete(`/channels/${channelUuid}/guides/${slot}`);
