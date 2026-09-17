import api from './axios';
import { cachedRequest, invalidateRequestCache } from './requestCache';

const PROFILE_KEY = 'user:profile';

export const getProfile = ({ force = false } = {}) => cachedRequest(
  PROFILE_KEY,
  () => api.get('/user/profile').then((response) => response.data),
  { ttl: 2000, force }
);

export const invalidateProfileCache = () => invalidateRequestCache(PROFILE_KEY);
