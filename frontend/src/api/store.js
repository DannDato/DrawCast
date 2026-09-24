import api from './axios';
import { cachedRequest } from './requestCache';

const STORE_CATALOG_KEY = 'store:catalog';
const STORE_LICENSES_KEY = 'store:licenses';

export const getStoreCatalog = ({ force = false } = {}) => cachedRequest(
  STORE_CATALOG_KEY,
  () => api.get('/store/catalog').then((response) => response.data),
  { ttl: 30000, force }
);

export const getStoreLicenses = ({ force = false } = {}) => cachedRequest(
  STORE_LICENSES_KEY,
  () => api.get('/store/licenses').then((response) => response.data),
  { ttl: 5000, force }
);
