import api from './axios';

export const uploadChannelImage = (channelUuid, file, onUploadProgress) => {
  const form = new FormData();
  form.append('image', file);
  return api.post(`/channels/${channelUuid}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress
  }).then((response) => response.data);
};

export const importChannelImageUrl = (channelUuid, url) => api.post(`/channels/${channelUuid}/import-image-url`, { url }).then((response) => response.data);

export const searchChannelImages = (channelUuid, query) => api.get(`/channels/${channelUuid}/image-search`, { params: { q: query } }).then((response) => response.data);
