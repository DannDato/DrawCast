import api from './axios';

export const uploadChannelImage = (channelId, file, onUploadProgress) => {
  const form = new FormData();
  form.append('image', file);
  return api.post(`/channels/${channelId}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress
  }).then((response) => response.data);
};

export const importChannelImageUrl = (channelId, url) => api.post(`/channels/${channelId}/import-image-url`, { url }).then((response) => response.data);

export const searchChannelImages = (channelId, query) => api.get(`/channels/${channelId}/image-search`, { params: { q: query } }).then((response) => response.data);
