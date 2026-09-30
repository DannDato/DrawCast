export function cartError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export function cartQuantity(value) {
  if (!Number.isInteger(value) || value < 1 || value > 99) throw cartError(400, 'CART_QUANTITY_INVALID', 'La cantidad debe estar entre 1 y 99.');
  return value;
}

export function summarizeCart(items, settings) {
  const subtotalCents = items.reduce((total, item) => total + item.lineTotalCents, 0);
  const remainingCents = Math.max(0, settings.minimumPurchaseCents - subtotalCents);
  return {
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotalCents,
    ...settings,
    remainingCents,
    canContinue: items.length > 0 && remainingCents === 0 && items.every((item) => !item.unavailableReason)
  };
}

export function validateCartReview(cart) {
  if (!cart.items.length) throw cartError(409, 'CART_EMPTY', 'Tu carrito está vacío.');
  if (cart.items.some((item) => item.unavailableReason)) throw cartError(409, 'CART_PRODUCT_UNAVAILABLE', 'Retira los productos que ya no están disponibles antes de continuar.');
  if (cart.remainingCents > 0) throw cartError(409, 'CART_MINIMUM_NOT_MET', `La compra mínima es de ${(cart.minimumPurchaseCents / 100).toFixed(2)} ${cart.currency}.`);
  return cart;
}
