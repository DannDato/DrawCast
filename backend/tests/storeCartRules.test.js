import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getStoreSettings } from '../services/storeSettingsService.js';
import { cartQuantity, summarizeCart, validateCartReview } from '../services/storeCartRules.js';

const settings = { minimumPurchaseCents: 3900, currency: 'MXN' };
const line = (cents, quantity = 1) => ({ quantity, lineTotalCents: cents * quantity, unavailableReason: '' });

test('el mínimo se configura en centavos y rechaza valores inválidos', () => {
  assert.deepEqual(getStoreSettings({}), settings);
  assert.equal(getStoreSettings({ STORE_MINIMUM_PURCHASE_CENTS: '450' }).minimumPurchaseCents, 450);
  for (const value of ['-1', '3.5', 'abc', '', 'Infinity', '100000001']) {
    assert.throws(() => getStoreSettings({ STORE_MINIMUM_PURCHASE_CENTS: value }));
  }
});

test('el servidor impide continuar por debajo de 39 MXN y permite el límite exacto', () => {
  const below = summarizeCart([line(3899)], settings);
  assert.equal(below.remainingCents, 1);
  assert.equal(below.canContinue, false);
  assert.throws(() => validateCartReview(below), { code: 'CART_MINIMUM_NOT_MET' });
  assert.equal(validateCartReview(summarizeCart([line(1300, 3)], settings)).canContinue, true);
});

test('cantidades y totales se acumulan sin decimales monetarios', () => {
  const cart = summarizeCart([line(99, 3), line(150, 2)], settings);
  assert.equal(cart.subtotalCents, 597);
  assert.equal(cart.itemCount, 5);
  assert.equal(cart.remainingCents, 3303);
});

test('un carrito vacío o con productos inválidos no puede avanzar aunque alcance el mínimo', () => {
  assert.throws(() => validateCartReview(summarizeCart([], settings)), { code: 'CART_EMPTY' });
  assert.equal(summarizeCart([], { ...settings, minimumPurchaseCents: 0 }).canContinue, false);
  const cart = summarizeCart([line(5000), { ...line(100), unavailableReason: 'No disponible' }], settings);
  assert.equal(cart.canContinue, false);
  assert.throws(() => validateCartReview(cart), { code: 'CART_PRODUCT_UNAVAILABLE' });
});

test('las cantidades deben ser enteros positivos y estar dentro del límite', () => {
  for (const value of [0, -1, 100, 1.5, '2', null, NaN]) assert.throws(() => cartQuantity(value), { code: 'CART_QUANTITY_INVALID' });
  assert.equal(cartQuantity(99), 99);
});
