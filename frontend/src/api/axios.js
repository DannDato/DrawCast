import axios from 'axios';
import { startLoading } from '../utils/loading';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  if (config.showLoading !== false) config.finishLoading = startLoading(config.loadingMessage);
  return config;
});

api.interceptors.response.use(
  (response) => {
    response.config.finishLoading?.();
    return response;
  },
  (error) => {
    error.config?.finishLoading?.();
    return Promise.reject(error);
  }
);

export default api;
