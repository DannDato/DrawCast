import crypto from 'node:crypto';
import { models } from '../models/index.js';
import { completeApprovedStoreOrder } from './storeOrderService.js';

const UUID_PATTERN = /^[a-f0-9-]{36}$/i;
const STRIPE_API = 'https://api.stripe.com/v1';
const WEBHOOK_TOLERANCE_SECONDS = 300;

function stripeError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export function stripeEnabled() {
  return process.env.STRIPE_ENABLED === 'true';
}

function stripeSecretKey() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!stripeEnabled()) throw stripeError(503, 'STRIPE_DISABLED', 'Los pagos con Stripe no están habilitados.');
  if (!key) throw stripeError(503, 'STRIPE_NOT_CONFIGURED', 'Stripe todavía no está configurado.');
  return key;
}

function webhookSecret() {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) throw stripeError(503, 'STRIPE_WEBHOOK_NOT_CONFIGURED', 'El webhook de Stripe todavía no está configurado.');
  return secret;
}

async function stripeRequest(path, { method = 'GET', params, idempotencyKey } = {}) {
  const headers = { Authorization: `Bearer ${stripeSecretKey()}` };
  const options = { method, headers, signal: AbortSignal.timeout(12000) };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
  }

  let response;
  try {
    response = await fetch(`${STRIPE_API}${path}`, options);
  } catch (error) {
    throw stripeError(502, 'STRIPE_UNAVAILABLE', `No fue posible contactar a Stripe: ${error.message}`);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || 'Stripe rechazó la solicitud de pago.';
    throw stripeError(response.status >= 500 ? 502 : 409, 'STRIPE_REQUEST_FAILED', message);
  }
  return body;
}

async function userOrder(userId, orderUuid) {
  const uuid = String(orderUuid || '').trim();
  if (!UUID_PATTERN.test(uuid)) throw stripeError(400, 'ORDER_INVALID', 'La orden no es válida.');
  const order = await models.StoreOrder.findOne({
    where: { uuid, userId: Number(userId) },
    include: [{ model: models.StoreOrderItem, as: 'items' }]
  });
  if (!order) throw stripeError(404, 'ORDER_NOT_FOUND', 'Orden no encontrada.');
  return order;
}

function validatePayableOrder(order) {
  if (String(order.status || '').toUpperCase() === 'PAID') return;
  if (String(order.status || '').toUpperCase() !== 'PENDING') throw stripeError(409, 'ORDER_NOT_PAYABLE', 'Esta orden ya no puede pagarse.');
  const amount = Number(order.totalCents);
  if (!Number.isInteger(amount) || amount <= 0) throw stripeError(409, 'ORDER_INVALID', 'El total de la orden no es válido.');
  if (!/^[A-Z]{3}$/.test(String(order.currency || ''))) throw stripeError(409, 'ORDER_INVALID', 'La moneda de la orden no es válida.');
  if (!Array.isArray(order.items) || !order.items.length || order.items.length > 50) throw stripeError(409, 'ORDER_INVALID', 'La orden no contiene productos válidos.');
  const total = order.items.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const priceCents = Number(item.priceCents);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99 || !Number.isInteger(priceCents) || priceCents < 0) throw stripeError(409, 'ORDER_INVALID', 'La orden contiene cantidades o precios inválidos.');
    if (item.currency !== order.currency || Number(item.totalCents) !== priceCents * quantity) throw stripeError(409, 'ORDER_INVALID', 'La orden contiene importes inconsistentes.');
    return sum + Number(item.totalCents);
  }, 0);
  if (total !== Number(order.totalCents)) throw stripeError(409, 'ORDER_INVALID', 'El total de la orden no coincide con sus productos.');
}

async function retrieveCheckoutSession(sessionId) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(String(sessionId || ''))) return null;
  try {
    return await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
  } catch (error) {
    if (error.status === 409) return null;
    throw error;
  }
}

function checkoutSessionParams(order) {
  const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${frontendUrl}/app/cart?order=${encodeURIComponent(order.uuid)}&stripe=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${frontendUrl}/app/cart?order=${encodeURIComponent(order.uuid)}&stripe=cancel`);
  params.set('client_reference_id', order.uuid);
  params.set('metadata[orderUuid]', order.uuid);
  order.items.forEach((item, index) => {
    params.set(`line_items[${index}][price_data][currency]`, String(order.currency).toLowerCase());
    params.set(`line_items[${index}][price_data][unit_amount]`, String(item.priceCents));
    params.set(`line_items[${index}][price_data][product_data][name]`, String(item.productName || item.productKey || 'Producto Trazio').slice(0, 120));
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
  });
  return params;
}

export async function getOrCreateStripeCheckoutSession(userId, orderUuid) {
  const order = await userOrder(userId, orderUuid);
  validatePayableOrder(order);
  if (String(order.status).toUpperCase() === 'PAID') return { orderUuid: order.uuid, status: 'PAID', url: null };

  if (order.paymentProvider === 'stripe' && order.paymentRef) {
    const existing = await retrieveCheckoutSession(order.paymentRef);
    if (existing && existing.status === 'open' && existing.url) {
      if (existing.metadata?.orderUuid !== order.uuid || existing.client_reference_id !== order.uuid || Number(existing.amount_total) !== Number(order.totalCents) || String(existing.currency).toUpperCase() !== order.currency) {
        throw stripeError(409, 'STRIPE_SESSION_MISMATCH', 'La sesión de Stripe no coincide con la orden.');
      }
      return { orderUuid: order.uuid, status: existing.status, url: existing.url };
    }
    if (existing?.status === 'complete') return { orderUuid: order.uuid, status: existing.status, url: null };
  }

  const attempt = Number(order.metadata?.stripeAttempt || 0) + 1;
  const session = await stripeRequest('/checkout/sessions', {
    method: 'POST',
    idempotencyKey: `trazio-order-${order.uuid}-${attempt}`,
    params: checkoutSessionParams(order)
  });
  if (!session?.id || !session?.url) throw stripeError(502, 'STRIPE_INVALID_RESPONSE', 'Stripe no devolvió una sesión de pago válida.');

  order.paymentProvider = 'stripe';
  order.paymentRef = session.id;
  order.metadata = { ...(order.metadata || {}), stripeCheckoutSessionId: session.id, stripeAttempt: attempt };
  await order.save();
  return { orderUuid: order.uuid, status: session.status, url: session.url };
}

export async function getStoreOrderPaymentStatus(userId, orderUuid) {
  const order = await userOrder(userId, orderUuid);
  return {
    orderUuid: order.uuid,
    status: String(order.status || '').toUpperCase(),
    paidAt: order.paidAt || null,
    inventoryReady: String(order.status || '').toUpperCase() === 'PAID',
    currency: order.currency,
    itemCount: Number(order.itemCount),
    totalCents: Number(order.totalCents)
  };
}

function parseStripeSignature(header) {
  const parts = String(header || '').split(',');
  let timestamp = null;
  const signatures = [];
  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (key === 't') timestamp = Number(value);
    if (key === 'v1' && value) signatures.push(value);
  }
  if (!Number.isInteger(timestamp) || !signatures.length) throw stripeError(400, 'STRIPE_SIGNATURE_INVALID', 'Firma de Stripe inválida.');
  return { timestamp, signatures };
}

function secureHexEqual(left, right) {
  try {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyStripeWebhook(rawBody, signatureHeader, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!Buffer.isBuffer(rawBody)) throw stripeError(400, 'STRIPE_WEBHOOK_BODY_INVALID', 'El cuerpo del webhook de Stripe no es válido.');
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) throw stripeError(400, 'STRIPE_SIGNATURE_EXPIRED', 'La firma de Stripe expiró.');
  const expected = crypto.createHmac('sha256', webhookSecret()).update(`${timestamp}.`).update(rawBody).digest('hex');
  if (!signatures.some((signature) => secureHexEqual(signature, expected))) throw stripeError(400, 'STRIPE_SIGNATURE_INVALID', 'Firma de Stripe inválida.');
  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw stripeError(400, 'STRIPE_WEBHOOK_BODY_INVALID', 'El webhook de Stripe no contiene JSON válido.');
  }
}

export async function handleStripeEvent(event) {
  if (!event?.id || !event?.type) throw stripeError(400, 'STRIPE_EVENT_INVALID', 'Evento de Stripe inválido.');
  const session = event.data?.object;
  const relevant = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired']);
  if (!relevant.has(event.type)) return { handled: false };
  if (event.type === 'checkout.session.completed' && session?.payment_status !== 'paid') return { handled: false };

  const orderUuid = String(session?.metadata?.orderUuid || '').trim();
  if (!UUID_PATTERN.test(orderUuid) || !session?.id) throw stripeError(400, 'STRIPE_EVENT_INVALID', 'La sesión de Stripe no contiene una orden válida.');
  const order = await models.StoreOrder.findOne({ where: { uuid: orderUuid } });
  if (!order) throw stripeError(404, 'ORDER_NOT_FOUND', 'La orden indicada por Stripe no existe.');
  if (order.paymentProvider !== 'stripe' || order.paymentRef !== session.id) throw stripeError(409, 'STRIPE_SESSION_MISMATCH', 'La sesión de Stripe no corresponde a la orden registrada.');

  if (['checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type)) {
    if (String(order.status || '').toUpperCase() === 'PENDING') {
      order.paymentProvider = null;
      order.paymentRef = null;
      order.metadata = { ...(order.metadata || {}), stripeLastSessionStatus: event.type, stripeLastSessionAt: new Date().toISOString() };
      await order.save();
    }
    return { handled: true, paymentReleased: true, orderUuid: order.uuid };
  }

  if (session?.payment_status !== 'paid') return { handled: false };
  if (session.client_reference_id !== order.uuid) throw stripeError(409, 'STRIPE_SESSION_MISMATCH', 'La referencia de Stripe no corresponde a la orden.');
  if (Number(session.amount_total) !== Number(order.totalCents)) throw stripeError(409, 'STRIPE_AMOUNT_MISMATCH', 'El importe confirmado por Stripe no coincide con la orden.');
  if (String(session.currency || '').toUpperCase() !== order.currency) throw stripeError(409, 'STRIPE_CURRENCY_MISMATCH', 'La moneda confirmada por Stripe no coincide con la orden.');

  const result = await completeApprovedStoreOrder(order.userId, order.uuid, { provider: 'stripe', paymentRef: session.id });
  return { handled: true, alreadyCompleted: result.alreadyCompleted, orderUuid: order.uuid };
}
