import crypto from 'node:crypto';
import { db, models } from '../models/index.js';
import { getStoreCatalogForUser, publicStoreProduct } from './storeCatalogService.js';
import { getStoreSettings } from './storeSettingsService.js';
import { buildStoreOrderSnapshot, createStoreOrderFromSnapshot } from './storeOrderService.js';
import { stripeEnabled } from './stripePaymentService.js';
import { cartError, cartQuantity, summarizeCart, validateCartReview } from './storeCartRules.js';

const CART_KEY = 'store.cart';
const UUID_PATTERN = /^[a-f0-9-]{36}$/i;
const CHECKOUT_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;

function normalizeStoredItems(value) {
  let items;
  try {
    items = JSON.parse(value || '[]');
  } catch {
    throw cartError(500, 'CART_INVALID', 'No se pudo leer el carrito.');
  }
  if (!Array.isArray(items) || items.length > 50) throw cartError(500, 'CART_INVALID', 'No se pudo leer el carrito.');

  const seen = new Set();
  return items.map((item) => {
    const productUuid = String(item?.productUuid || '').trim();
    if (!UUID_PATTERN.test(productUuid) || seen.has(productUuid)) throw cartError(500, 'CART_INVALID', 'No se pudo leer el carrito.');
    seen.add(productUuid);
    try {
      return { productUuid, quantity: cartQuantity(item?.quantity) };
    } catch {
      throw cartError(500, 'CART_INVALID', 'No se pudo leer el carrito.');
    }
  });
}

async function readItems(userId, transaction) {
  const row = await models.UserSetting.findOne({ where: { userId, key: CART_KEY }, transaction });
  return row ? normalizeStoredItems(row.value) : [];
}

function fingerprintCart(cart) {
  const canonical = {
    currency: cart.currency,
    itemCount: cart.itemCount,
    subtotalCents: cart.subtotalCents,
    items: cart.items
      .map((item) => ({
        productUuid: item.productUuid,
        quantity: item.quantity,
        priceCents: item.product?.priceCents ?? null,
        currency: item.product?.currency ?? null,
        lineTotalCents: item.lineTotalCents,
        unavailableReason: item.unavailableReason || ''
      }))
      .sort((a, b) => a.productUuid.localeCompare(b.productUuid))
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function buildCart(items, entries) {
  const settings = getStoreSettings();
  const cart = summarizeCart(items.map((item) => {
    const entry = entries.find(({ product }) => product.uuid === item.productUuid);
    const product = entry ? publicStoreProduct(entry.product, { eligibility: entry.eligibility }) : null;
    const unavailableReason = !product ? 'Este producto ya no está disponible.'
      : product.currency !== settings.currency ? 'La moneda de este producto no es compatible con el carrito.'
        : entry.eligibility?.purchaseAvailable === false ? 'Este producto no está disponible para comprar.' : '';
    return {
      ...item,
      product,
      unavailableReason,
      requiresBase: entry?.eligibility?.requirementsMet === false,
      lineTotalCents: unavailableReason ? 0 : product.priceCents * item.quantity
    };
  }), settings);

  return { ...cart, checkoutFingerprint: fingerprintCart(cart) };
}

function checkoutChanged() {
  return cartError(409, 'CART_CHANGED', 'Tu carrito cambió. Lo actualizamos para que puedas continuar con los datos correctos.');
}

function checkoutFingerprint(payload) {
  const fingerprint = String(payload?.fingerprint || '').trim().toLowerCase();
  if (!CHECKOUT_FINGERPRINT_PATTERN.test(fingerprint)) {
    throw cartError(400, 'CART_CHECKOUT_INVALID', 'No se pudo preparar el pago. Actualiza el carrito e inténtalo de nuevo.');
  }
  return fingerprint;
}

export async function getUserCart(userId) {
  const [items, { entries }] = await Promise.all([readItems(userId), getStoreCatalogForUser(userId)]);
  return buildCart(items, entries);
}

export async function changeUserCart(userId, { productUuid, quantity, action }) {
  if (typeof productUuid !== 'string' || !UUID_PATTERN.test(productUuid)) throw cartError(400, 'CART_PRODUCT_INVALID', 'El producto no es válido.');
  if (!['add', 'set', 'remove'].includes(action)) throw cartError(400, 'CART_ACTION_INVALID', 'La acción del carrito no es válida.');
  if (action !== 'remove') cartQuantity(quantity);

  return db.transaction(async (transaction) => {
    const user = await models.User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw cartError(401, 'CART_USER_NOT_FOUND', 'Inicia sesión para usar el carrito.');
    let items = await readItems(userId, transaction);
    const { entries } = await getStoreCatalogForUser(userId);
    const current = items.find((item) => item.productUuid === productUuid);

    if (action === 'remove') {
      items = items.filter((item) => item.productUuid !== productUuid);
    } else {
      const entry = entries.find(({ product }) => product.uuid === productUuid);
      if (!entry || entry.eligibility?.purchaseAvailable === false) throw cartError(409, 'CART_PRODUCT_UNAVAILABLE', 'Este producto no está disponible para agregarlo al carrito.');
      if (entry.product.currency !== getStoreSettings().currency) throw cartError(409, 'CART_CURRENCY_INVALID', 'La moneda de este producto no es compatible con el carrito.');
      const nextQuantity = cartQuantity(action === 'add' ? (current?.quantity || 0) + quantity : quantity);
      if (current) current.quantity = nextQuantity;
      else {
        if (items.length >= 50) throw cartError(409, 'CART_LIMIT', 'Puedes agregar hasta 50 productos diferentes.');
        items.push({ productUuid, quantity: nextQuantity });
      }
    }

    await models.UserSetting.upsert({ userId, key: CART_KEY, value: JSON.stringify(items) }, { transaction });
    return buildCart(items, entries);
  });
}

export async function prepareUserCheckout(userId, payload) {
  const expectedFingerprint = checkoutFingerprint(payload);

  return db.transaction(async (transaction) => {
    const user = await models.User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw cartError(401, 'CART_USER_NOT_FOUND', 'Inicia sesión para continuar con tu compra.');

    const items = await readItems(userId, transaction);
    const { entries } = await getStoreCatalogForUser(userId);
    const cart = buildCart(items, entries);
    validateCartReview(cart);
    if (cart.checkoutFingerprint !== expectedFingerprint) throw checkoutChanged();

    const snapshot = buildStoreOrderSnapshot(cart);
    const productIdsByUuid = new Map(entries.map(({ product }) => [product.uuid, product.id]));
    const { order, reused } = await createStoreOrderFromSnapshot(userId, snapshot, productIdsByUuid, transaction, {
      checkoutFingerprint: cart.checkoutFingerprint,
      cartItems: items
    });

    return {
      ...cart,
      checkout: {
        validated: true,
        orderUuid: order.uuid,
        reused,
        currency: snapshot.order.currency,
        itemCount: snapshot.order.itemCount,
        totalCents: snapshot.order.totalCents
      },
      paymentAvailable: stripeEnabled(),
      paymentSimulationEnabled: process.env.NODE_ENV !== 'production' && process.env.STORE_SIMULATION_ENABLED !== 'false'
    };
  });
}
