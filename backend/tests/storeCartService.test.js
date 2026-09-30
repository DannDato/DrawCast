import assert from 'node:assert/strict';
import { test } from 'node:test';
import { db, models } from '../models/index.js';
import { changeUserCart, getUserCart, reviewUserCart } from '../services/storeCartService.js';

test('carritos aislados, cantidades acumuladas y revisión con precios actuales del servidor', async (t) => {
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
  t.mock.method(models.UserSetting, 'findOne', async ({ where }) => {
    assert.equal(where.key, 'store.cart');
    return rows.has(where.userId) ? { value: rows.get(where.userId) } : null;
  });
  t.mock.method(models.UserSetting, 'upsert', async (row, options) => {
    assert.equal(options.transaction, transaction);
    rows.set(row.userId, row.value);
  });
  t.mock.method(models.StoreProduct, 'findAll', async () => available ? [product] : []);
  t.mock.method(models.Channel, 'findAll', async () => []);
  t.mock.method(models.UserLicense, 'findAll', async () => []);

  await Promise.all([
    changeUserCart(1, { productUuid, quantity: 1, action: 'add' }),
    changeUserCart(1, { productUuid, quantity: 1, action: 'add' })
  ]);
  assert.equal((await getUserCart(1)).items.length, 1);
  assert.equal((await getUserCart(1)).itemCount, 2);
  assert.equal((await getUserCart(2)).itemCount, 0);
  await assert.rejects(reviewUserCart(1), { code: 'CART_MINIMUM_NOT_MET' });

  await changeUserCart(2, { productUuid, quantity: 4, action: 'add' });
  await changeUserCart(1, { productUuid, quantity: 3, action: 'set' });
  assert.equal((await reviewUserCart(1)).subtotalCents, 300);
  assert.equal((await reviewUserCart(1)).paymentAvailable, false);
  product.priceCents = 150;
  assert.equal((await reviewUserCart(1)).subtotalCents, 450);
  assert.equal((await getUserCart(2)).itemCount, 4);

  product.kind = 'tool';
  const ownership = t.mock.method(models.UserLicense, 'findAll', async () => [{ product, quantity: 1, assignments: [] }]);
  const ownedCart = await changeUserCart(1, { productUuid, quantity: 1, action: 'add' });
  assert.equal(ownedCart.items[0].product.eligibility.state, 'in_inventory');
  assert.equal(ownedCart.items[0].product.eligibility.purchaseAvailable, true);
  assert.equal(ownedCart.items[0].quantity, 4);
  assert.equal((await reviewUserCart(1)).canContinue, true);
  ownership.mock.restore();

  product.currency = 'EUR';
  await assert.rejects(reviewUserCart(1), { code: 'CART_PRODUCT_UNAVAILABLE' });
  product.currency = 'MXN';
  available = false;
  await assert.rejects(reviewUserCart(1), { code: 'CART_PRODUCT_UNAVAILABLE' });
  await changeUserCart(1, { productUuid, action: 'remove' });
  assert.equal((await getUserCart(1)).itemCount, 0);
  assert.equal((await getUserCart(2)).itemCount, 4);
  await assert.rejects(changeUserCart(1, { productUuid, quantity: 1, action: 'add' }), { code: 'CART_PRODUCT_UNAVAILABLE' });
});
