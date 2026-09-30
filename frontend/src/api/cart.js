import api from './axios';

export const getCart = () => api.get('/store/cart', { showLoading: false }).then((response) => response.data);
export const addCartItem = (productUuid) => api.post('/store/cart/items', { productUuid, quantity: 1 }).then((response) => response.data);
export const updateCartItem = (productUuid, quantity) => api.patch(`/store/cart/items/${productUuid}`, { quantity }).then((response) => response.data);
export const removeCartItem = (productUuid) => api.delete(`/store/cart/items/${productUuid}`).then((response) => response.data);
export const reviewCart = () => api.post('/store/cart/review').then((response) => response.data);
