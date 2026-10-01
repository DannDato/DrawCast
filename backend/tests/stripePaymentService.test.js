import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { models } from '../models/index.js';
import { handleStripeEvent, verifyStripeWebhook } from '../services/stripePaymentService.js';

function signedPayload(body, secret, timestamp) {
  const raw = Buffer.from(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex');
  return { raw, header: `t=${timestamp},v1=${signature}` };
}

test('webhook Stripe exige firma válida y dentro de tolerancia', () => {
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  try {
    const timestamp = 1_700_000_000;
    const event = { id: 'evt_test', type: 'checkout.session.completed', data: { object: {} } };
    const { raw, header } = signedPayload(event, process.env.STRIPE_WEBHOOK_SECRET, timestamp);
    assert.deepEqual(verifyStripeWebhook(raw, header, timestamp), event);
    assert.throws(() => verifyStripeWebhook(raw, `t=${timestamp},v1=deadbeef`, timestamp), { code: 'STRIPE_SIGNATURE_INVALID' });
    assert.throws(() => verifyStripeWebhook(raw, header, timestamp + 301), { code: 'STRIPE_SIGNATURE_EXPIRED' });
  } finally {
    if (previous === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previous;
  }
});

test('evento Stripe no puede pagar una orden con importe o sesión distintos', async (t) => {
  const order = {
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', userId: 7, status: 'PENDING',
    totalCents: 5400, currency: 'MXN', paymentProvider: 'stripe', paymentRef: 'cs_expected'
  };
  t.mock.method(models.StoreOrder, 'findOne', async () => order);
  const base = {
    id: 'evt_test', type: 'checkout.session.completed',
    data: { object: { id: 'cs_expected', payment_status: 'paid', amount_total: 5300, currency: 'mxn', client_reference_id: order.uuid, metadata: { orderUuid: order.uuid } } }
  };
  await assert.rejects(handleStripeEvent(base), { code: 'STRIPE_AMOUNT_MISMATCH' });
  base.data.object.amount_total = 5400; base.data.object.id = 'cs_other';
  await assert.rejects(handleStripeEvent(base), { code: 'STRIPE_SESSION_MISMATCH' });
});

test('checkout.session.completed sin pago confirmado no entrega licencias', async () => {
  const result = await handleStripeEvent({
    id: 'evt_unpaid', type: 'checkout.session.completed',
    data: { object: { id: 'cs_unpaid', payment_status: 'unpaid' } }
  });
  assert.deepEqual(result, { handled: false });
});

test('sesión expirada libera la orden pending para un nuevo intento', async (t) => {
  const order = {
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', userId: 8, status: 'PENDING',
    paymentProvider: 'stripe', paymentRef: 'cs_expired', metadata: {},
    async save() { return this; }
  };
  t.mock.method(models.StoreOrder, 'findOne', async () => order);
  const result = await handleStripeEvent({
    id: 'evt_expired', type: 'checkout.session.expired',
    data: { object: { id: 'cs_expired', metadata: { orderUuid: order.uuid } } }
  });
  assert.equal(result.paymentReleased, true);
  assert.equal(order.paymentProvider, null);
  assert.equal(order.paymentRef, null);
});
