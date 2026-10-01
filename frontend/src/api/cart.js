import api from './axios';
import { invalidateRequestCache } from './requestCache';

export const getCart = () => api.get('/store/cart', { showLoading: false }).then((response) => response.data);
export const addCartItem = (productUuid) => api.post('/store/cart/items', { productUuid, quantity: 1 }).then((response) => response.data);
export const updateCartItem = (productUuid, quantity) => api.patch(`/store/cart/items/${productUuid}`, { quantity }).then((response) => response.data);
export const removeCartItem = (productUuid) => api.delete(`/store/cart/items/${productUuid}`).then((response) => response.data);
export const prepareCheckout = (fingerprint) => api.post('/store/cart/checkout', { fingerprint }).then((response) => response.data);

export const approveDevPayment = async (orderUuid) => {
  const result = await api.post(`/store/orders/${orderUuid}/dev/approve-payment`).then((response) => response.data);
  invalidateRequestCache('store:');
  invalidateRequestCache('channels:');
  return result;
};

export const createStripeCheckoutSession = (orderUuid) => api.post(`/store/orders/${orderUuid}/checkout-session`, {}).then((response) => response.data);
export const getOrderPaymentStatus = (orderUuid) => api.get(`/store/orders/${orderUuid}/status`, { showLoading: false }).then((response) => response.data);
