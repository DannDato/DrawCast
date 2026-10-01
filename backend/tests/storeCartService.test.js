import assert from 'node:assert/strict';
import { test } from 'node:test';
import { db, models } from '../models/index.js';
import { changeUserCart, getUserCart, prepareUserCheckout } from '../services/storeCartService.js';

async function checkoutCurrentCart(userId) {
  const cart = await getUserCart(userId);
  return prepareUserCheckout(userId, { fingerprint: cart.checkoutFingerprint });
}

test('carritos aislados, checkout autoritativo y huella contra estado desfasado', async (t) => {
  const originalMinimum = process.env.STORE_MINIMUM_PURCHASE_CENTS;
  process.env.STORE_MINIMUM_PURCHASE_CENTS = '300';
  t.after(() => {
    if (originalMinimum === undefined) delete process.env.STORE_MINIMUM_PURCHASE_CENTS;
    else process.env.STORE_MINIMUM_PURCHASE_CENTS = originalMinimum;
  });

  const rows = new Map();
  const productUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const product = { id: 1, uuid: productUuid, key: 'cart.test', name: 'Producto', priceCents: 100, currency: 'MXN', kind: 'addon', targetScope: 'account', active: true, metadata: {}, requirements: [], bundleLinks: [] };
  let available = true;
  let queue = Promise.resolve();
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  t.mock.method(db, 'transaction', (callback) => {
    const work = queue.then(() => callback(transaction));
    queue = work.catch(() => {});
    return work;
  });
  t.mock.method(models.User, 'findByPk', async (id, options) => {
    assert.equal(options.lock, 'UPDATE');
    assert.equal(options.transaction, transaction);
    return { id };
  });
  t.mock.method(models.UserSetting, 'findOne', async ({ where }) => rows.has(where.userId) ? { value: rows.get(where.userId) } : null);
  t.mock.method(models.UserSetting, 'upsert', async (row, options) => {
    assert.equal(options.transaction, transaction);
    rows.set(row.userId, row.value);
  });
  t.mock.method(models.StoreProduct, 'findAll', async () => available ? [product] : []);
  t.mock.method(models.Channel, 'findAll', async () => []);
  t.mock.method(models.UserLicense, 'findAll', async () => []);
  t.mock.method(models.StoreOrder, 'findAll', async () => []);
  let nextOrderId = 1;
  t.mock.method(models.StoreOrder, 'create', async (row) => ({ id: nextOrderId, uuid: `00000000-0000-4000-8000-${String(nextOrderId++).padStart(12, '0')}`, ...row }));
  t.mock.method(models.StoreOrderItem, 'bulkCreate', async (items) => items);

  await Promise.all([
    changeUserCart(1, { productUuid, quantity: 1, action: 'add' }),
    changeUserCart(1, { productUuid, quantity: 1, action: 'add' })
  ]);
  assert.equal((await getUserCart(1)).itemCount, 2);
  assert.equal((await getUserCart(2)).itemCount, 0);
  await assert.rejects(checkoutCurrentCart(1), { code: 'CART_MINIMUM_NOT_MET' });

  await changeUserCart(1, { productUuid, quantity: 3, action: 'set' });
  const current = await getUserCart(1);
  assert.match(current.checkoutFingerprint, /^[a-f0-9]{64}$/);
  const checkout = await prepareUserCheckout(1, { fingerprint: current.checkoutFingerprint });
  assert.equal(checkout.subtotalCents, 300);
  assert.ok(checkout.checkout.orderUuid);

  const staleFingerprint = (await getUserCart(1)).checkoutFingerprint;
  product.priceCents = 150;
  await assert.rejects(prepareUserCheckout(1, { fingerprint: staleFingerprint }), { code: 'CART_CHANGED' });
  assert.equal((await checkoutCurrentCart(1)).subtotalCents, 450);

  product.currency = 'EUR';
  await assert.rejects(checkoutCurrentCart(1), { code: 'CART_PRODUCT_UNAVAILABLE' });
  product.currency = 'MXN';
  available = false;
  await assert.rejects(checkoutCurrentCart(1), { code: 'CART_PRODUCT_UNAVAILABLE' });
  available = true;

  await assert.rejects(prepareUserCheckout(1, {}), { code: 'CART_CHECKOUT_INVALID' });
  await assert.rejects(changeUserCart(1, { productUuid, quantity: 1, action: 'wat' }), { code: 'CART_ACTION_INVALID' });
});

test('checkout reutiliza una orden pending para la misma huella', async (t) => {
  const originalMinimum = process.env.STORE_MINIMUM_PURCHASE_CENTS;
  process.env.STORE_MINIMUM_PURCHASE_CENTS = '100';
  t.after(() => {
    if (originalMinimum === undefined) delete process.env.STORE_MINIMUM_PURCHASE_CENTS;
    else process.env.STORE_MINIMUM_PURCHASE_CENTS = originalMinimum;
  });

  const productUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const product = { id: 2, uuid: productUuid, key: 'cart.reuse', name: 'Producto reusable', priceCents: 100, currency: 'MXN', kind: 'addon', targetScope: 'account', active: true, metadata: {}, requirements: [], bundleLinks: [] };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  let stored = JSON.stringify([{ productUuid, quantity: 1 }]);
  t.mock.method(db, 'transaction', (callback) => callback(transaction));
  t.mock.method(models.User, 'findByPk', async () => ({ id: 9 }));
  t.mock.method(models.UserSetting, 'findOne', async () => ({ value: stored }));
  t.mock.method(models.StoreProduct, 'findAll', async () => [product]);
  t.mock.method(models.Channel, 'findAll', async () => []);
  t.mock.method(models.UserLicense, 'findAll', async () => []);

  const cart = await getUserCart(9);
  const existing = { id: 33, uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', totalCents: 100, itemCount: 1, currency: 'MXN', metadata: { checkoutFingerprint: cart.checkoutFingerprint } };
  t.mock.method(models.StoreOrder, 'findAll', async () => [existing]);
  const create = t.mock.method(models.StoreOrder, 'create', async () => { throw new Error('no debe crear'); });

  const result = await prepareUserCheckout(9, { fingerprint: cart.checkoutFingerprint });
  assert.equal(result.checkout.orderUuid, existing.uuid);
  assert.equal(result.checkout.reused, true);
  assert.equal(create.mock.callCount(), 0);
});
