import api from './axios';
import { cachedRequest, invalidateRequestCache } from './requestCache';

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

export const simulateStorePurchase = async (productUuid, { acknowledgeUnmetRequirements = false } = {}) => {
  const result = await api.post('/store/dev/purchases', { productUuid, acknowledgeUnmetRequirements }).then((response) => response.data);
  invalidateRequestCache('store:');
  invalidateRequestCache('channels:');
  return result;
};

export const assignStoreLicense = async (licenseUuid, channelUuid) => {
  const result = await api.post(`/store/licenses/${licenseUuid}/assign`, { channelUuid }).then((response) => response.data);
  invalidateRequestCache('store:');
  invalidateRequestCache('channels:');
  return result;
};

export const releaseStoreLicense = async (licenseUuid, assignmentUuid) => {
  const result = await api.delete(`/store/licenses/${licenseUuid}/assignments/${assignmentUuid}`).then((response) => response.data);
  invalidateRequestCache('store:');
  invalidateRequestCache('channels:');
  return result;
};
