import assert from 'node:assert/strict';
import { test } from 'node:test';
import { db, models } from '../models/index.js';
import { buildStoreOrderSnapshot, completeApprovedStoreOrder } from '../services/storeOrderService.js';

function reviewedCart() {
  return {
    currency: 'MXN', minimumPurchaseCents: 3900, remainingCents: 0, subtotalCents: 5400,
    items: [{
      productUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quantity: 2, lineTotalCents: 5400, unavailableReason: '',
      product: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', key: 'tool.test', name: 'Herramienta Test', priceCents: 2700, currency: 'MXN', billingInterval: 'one_time', metadata: { icon: 'test' } }
    }]
  };
}

test('la orden congela producto, precio, moneda, cantidad y total', () => {
  const cart = reviewedCart();
  const snapshot = buildStoreOrderSnapshot(cart);
  assert.deepEqual(snapshot.order, { status: 'PENDING', currency: 'MXN', itemCount: 2, subtotalCents: 5400, totalCents: 5400 });
  assert.equal(snapshot.items[0].productName, 'Herramienta Test');
  assert.equal(snapshot.items[0].totalCents, 5400);
  cart.items[0].product.name = 'Nombre nuevo';
  assert.equal(snapshot.items[0].productSnapshot.name, 'Herramienta Test');
});

test('rechaza totales o monedas inconsistentes antes de formar una orden', () => {
  const badTotal = reviewedCart(); badTotal.items[0].lineTotalCents = 5300;
  assert.throws(() => buildStoreOrderSnapshot(badTotal), { code: 'ORDER_TOTAL_MISMATCH' });
  const badCurrency = reviewedCart(); badCurrency.items[0].product.currency = 'USD';
  assert.throws(() => buildStoreOrderSnapshot(badCurrency), { code: 'ORDER_CURRENCY_MISMATCH' });
});

function payableOrder() {
  return {
    id: 10,
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    userId: 7,
    status: 'PENDING',
    currency: 'MXN',
    itemCount: 2,
    subtotalCents: 5400,
    totalCents: 5400,
    paymentProvider: null,
    paymentRef: null,
    metadata: { cartItems: [{ productUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quantity: 2 }] },
    items: [{
      id: 20,
      uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      productId: 30,
      productUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      productKey: 'tool.test',
      productName: 'Herramienta Test',
      priceCents: 2700,
      totalCents: 5400,
      currency: 'MXN',
      quantity: 2,
      productSnapshot: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', key: 'tool.test', billingInterval: 'one_time' }
    }],
    async save(options) { assert.ok(options.transaction); return this; }
  };
}

test('pago aprobado genera licencias, marca orden pagada y vacía sólo el carrito que originó la orden', async (t) => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const order = payableOrder();
  t.mock.method(db, 'transaction', (callback) => callback(transaction));
  t.mock.method(models.User, 'findByPk', async () => ({ id: 7 }));
  t.mock.method(models.StoreOrder, 'findOne', async (options) => options.where.uuid ? order : null);
  const created = [];
  t.mock.method(models.UserLicense, 'create', async (row) => { const license = { uuid: `license-${created.length + 1}`, ...row }; created.push(license); return license; });
  t.mock.method(models.UserSetting, 'findOne', async () => ({ value: JSON.stringify(order.metadata.cartItems) }));
  const upsert = t.mock.method(models.UserSetting, 'upsert', async (row) => assert.equal(row.value, '[]'));

  const result = await completeApprovedStoreOrder(7, order.uuid, { provider: 'test', paymentRef: 'pay_123' });
  assert.equal(result.alreadyCompleted, false);
  assert.equal(result.cartCleared, true);
  assert.equal(order.status, 'PAID');
  assert.equal(order.paymentProvider, 'test');
  assert.equal(order.paymentRef, 'pay_123');
  assert.equal(result.licenses.length, 2);
  assert.equal(upsert.mock.callCount(), 1);
});

test('pago aprobado conserva un carrito nuevo creado después de iniciar el pago', async (t) => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const order = payableOrder();
  t.mock.method(db, 'transaction', (callback) => callback(transaction));
  t.mock.method(models.User, 'findByPk', async () => ({ id: 7 }));
  t.mock.method(models.StoreOrder, 'findOne', async (options) => options.where.uuid ? order : null);
  t.mock.method(models.UserLicense, 'create', async (row) => row);
  t.mock.method(models.UserSetting, 'findOne', async () => ({ value: JSON.stringify([{ productUuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', quantity: 1 }]) }));
  const upsert = t.mock.method(models.UserSetting, 'upsert', async () => {});

  const result = await completeApprovedStoreOrder(7, order.uuid, { provider: 'test', paymentRef: 'pay_new_cart' });
  assert.equal(result.cartCleared, false);
  assert.equal(upsert.mock.callCount(), 0);
});

test('repetir la misma aprobación es idempotente y otra referencia es rechazada', async (t) => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const order = payableOrder();
  order.status = 'PAID';
  order.paymentProvider = 'test';
  order.paymentRef = 'pay_123';
  t.mock.method(db, 'transaction', (callback) => callback(transaction));
  t.mock.method(models.User, 'findByPk', async () => ({ id: 7 }));
  t.mock.method(models.StoreOrder, 'findOne', async () => order);
  t.mock.method(models.UserLicense, 'findAll', async () => [{ uuid: 'license-1', metadata: { orderUuid: order.uuid } }]);
  const create = t.mock.method(models.UserLicense, 'create', async () => { throw new Error('no debe crear'); });

  const same = await completeApprovedStoreOrder(7, order.uuid, { provider: 'test', paymentRef: 'pay_123' });
  assert.equal(same.alreadyCompleted, true);
  assert.equal(create.mock.callCount(), 0);
  await assert.rejects(completeApprovedStoreOrder(7, order.uuid, { provider: 'test', paymentRef: 'pay_other' }), { code: 'PAYMENT_REFERENCE_MISMATCH' });
});
