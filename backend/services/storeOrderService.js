import { Op } from 'sequelize';
import { db, models } from '../models/index.js';
import { cartError, validateCartReview } from './storeCartRules.js';

const CART_KEY = 'store.cart';
const UUID_PATTERN = /^[a-f0-9-]{36}$/i;

function frozenProduct(product) {
  if (!product?.uuid || !product?.key || !product?.name) {
    throw cartError(409, 'ORDER_PRODUCT_INVALID', 'No se pudo congelar uno de los productos del carrito.');
  }
  return JSON.parse(JSON.stringify(product));
}

function nextPeriodEnd(interval, from = new Date()) {
  if (interval === 'one_time') return null;
  const next = new Date(from);
  if (interval === 'year') next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function canonicalCartItems(items) {
  if (!Array.isArray(items)) return null;
  const normalized = items.map((item) => ({
    productUuid: String(item?.productUuid || ''),
    quantity: Number(item?.quantity)
  }));
  if (normalized.some((item) => !UUID_PATTERN.test(item.productUuid) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) return null;
  if (new Set(normalized.map((item) => item.productUuid)).size !== normalized.length) return null;
  return normalized.sort((a, b) => a.productUuid.localeCompare(b.productUuid));
}

function sameCartItems(left = [], right = []) {
  const a = canonicalCartItems(left);
  const b = canonicalCartItems(right);
  return Boolean(a && b && JSON.stringify(a) === JSON.stringify(b));
}

function orderError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function cleanPaymentValue(value, maxLength, field) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text.length > maxLength) throw orderError(400, 'PAYMENT_REFERENCE_INVALID', `${field} del pago no es válido.`);
  return text;
}

function validateStoredOrder(order) {
  const items = order.items || [];
  if (!items.length || items.length > 50) throw orderError(409, 'ORDER_ITEMS_MISSING', 'La orden no tiene productos válidos para licenciar.');

  let itemCount = 0;
  let totalCents = 0;
  for (const item of items) {
    const quantity = Number(item.quantity);
    const priceCents = Number(item.priceCents);
    const lineTotal = Number(item.totalCents);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw orderError(409, 'ORDER_INVALID', 'La cantidad guardada en la orden no es válida.');
    if (!Number.isInteger(priceCents) || priceCents < 0 || lineTotal !== priceCents * quantity) throw orderError(409, 'ORDER_INVALID', 'El precio guardado en la orden no es válido.');
    if (item.currency !== order.currency) throw orderError(409, 'ORDER_INVALID', 'La moneda guardada en la orden no es válida.');
    if (item.productSnapshot?.uuid !== item.productUuid || item.productSnapshot?.key !== item.productKey) throw orderError(409, 'ORDER_INVALID', 'El producto guardado en la orden no es válido.');
    itemCount += quantity;
    totalCents += lineTotal;
  }

  if (itemCount !== Number(order.itemCount) || totalCents !== Number(order.subtotalCents) || totalCents !== Number(order.totalCents)) {
    throw orderError(409, 'ORDER_INVALID', 'Los totales guardados en la orden no son válidos.');
  }
}

export function buildStoreOrderSnapshot(cart) {
  validateCartReview(cart);

  const currency = String(cart.currency || '').toUpperCase();
  if (currency.length !== 3) throw cartError(409, 'ORDER_CURRENCY_INVALID', 'La moneda de la orden no es válida.');

  const items = cart.items.map((item) => {
    const product = frozenProduct(item.product);
    const quantity = Number(item.quantity);
    const priceCents = Number(product.priceCents);
    const totalCents = priceCents * quantity;

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw cartError(409, 'ORDER_QUANTITY_INVALID', 'La cantidad de la orden no es válida.');
    if (!Number.isInteger(priceCents) || priceCents < 0) throw cartError(409, 'ORDER_PRICE_INVALID', 'El precio de la orden no es válido.');
    if (product.currency !== currency) throw cartError(409, 'ORDER_CURRENCY_MISMATCH', 'Todos los productos de la orden deben usar la misma moneda.');
    if (Number(item.lineTotalCents) !== totalCents) throw cartError(409, 'ORDER_TOTAL_MISMATCH', 'El total de uno de los productos cambió. Actualiza el carrito.');

    return {
      productUuid: product.uuid,
      productKey: product.key,
      productName: product.name,
      priceCents,
      currency,
      quantity,
      totalCents,
      productSnapshot: product
    };
  });

  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  if (Number(cart.subtotalCents) !== subtotalCents) throw cartError(409, 'ORDER_SUBTOTAL_MISMATCH', 'El subtotal cambió. Actualiza el carrito.');

  return {
    order: {
      status: 'PENDING',
      currency,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotalCents,
      totalCents: subtotalCents
    },
    items
  };
}

export async function createStoreOrderFromSnapshot(userId, snapshot, productIdsByUuid, transaction, { checkoutFingerprint, cartItems } = {}) {
  const pending = await models.StoreOrder.findAll({
    where: { userId: Number(userId), status: 'PENDING' },
    order: [['createdAt', 'DESC']],
    limit: 20,
    transaction
  });
  const reusable = pending.find((order) => order.metadata?.checkoutFingerprint === checkoutFingerprint
    && Number(order.totalCents) === Number(snapshot.order.totalCents)
    && order.currency === snapshot.order.currency
    && Number(order.itemCount) === Number(snapshot.order.itemCount));
  if (reusable) return { order: reusable, reused: true };

  const order = await models.StoreOrder.create({
    userId: Number(userId),
    ...snapshot.order,
    metadata: {
      checkoutValidatedAt: new Date().toISOString(),
      checkoutFingerprint,
      cartItems: (cartItems || []).map((item) => ({ productUuid: item.productUuid, quantity: item.quantity }))
    }
  }, { transaction });

  await models.StoreOrderItem.bulkCreate(snapshot.items.map((item) => ({
    orderId: order.id,
    productId: productIdsByUuid.get(item.productUuid) || null,
    ...item
  })), { transaction });

  return { order, reused: false };
}

export async function completeApprovedStoreOrder(userId, orderUuid, { provider = 'pending', paymentRef = null } = {}) {
  const uuid = String(orderUuid || '').trim();
  if (!UUID_PATTERN.test(uuid)) throw orderError(400, 'ORDER_INVALID', 'La orden no es válida.');
  const cleanProvider = cleanPaymentValue(provider, 64, 'El proveedor');
  const cleanPaymentRef = cleanPaymentValue(paymentRef, 191, 'La referencia');
  if (!cleanProvider || !cleanPaymentRef) throw orderError(400, 'PAYMENT_REFERENCE_REQUIRED', 'La confirmación del pago necesita proveedor y referencia.');

  return db.transaction(async (transaction) => {
    const user = await models.User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw orderError(401, 'ORDER_USER_NOT_FOUND', 'Inicia sesión para completar la compra.');

    const order = await models.StoreOrder.findOne({
      where: { uuid, userId: Number(userId) },
      include: [{ model: models.StoreOrderItem, as: 'items' }],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!order) throw orderError(404, 'ORDER_NOT_FOUND', 'Orden no encontrada.');

    const status = String(order.status || '').toUpperCase();
    if (status === 'PAID') {
      const storedProvider = order.paymentProvider || order.metadata?.payment?.provider || null;
      const storedPaymentRef = order.paymentRef || order.metadata?.payment?.reference || null;
      if (storedProvider && (storedProvider !== cleanProvider || storedPaymentRef !== cleanPaymentRef)) {
        throw orderError(409, 'PAYMENT_REFERENCE_MISMATCH', 'Esta orden ya fue pagada con otra referencia.');
      }
      const licenses = await models.UserLicense.findAll({ where: { userId: Number(userId), sourceType: 'store_order' }, transaction });
      return { order, licenses: licenses.filter((license) => license.metadata?.orderUuid === order.uuid), alreadyCompleted: true, cartCleared: false };
    }
    if (status !== 'PENDING') throw orderError(409, 'ORDER_NOT_PAYABLE', 'Esta orden ya no puede marcarse como pagada.');

    const paymentAlreadyUsed = await models.StoreOrder.findOne({
      where: {
        id: { [Op.ne]: order.id },
        paymentProvider: cleanProvider,
        paymentRef: cleanPaymentRef
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (paymentAlreadyUsed) throw orderError(409, 'PAYMENT_REFERENCE_USED', 'Esta referencia de pago ya fue utilizada.');

    validateStoredOrder(order);
    const now = new Date();
    const licenses = [];
    for (const item of order.items) {
      if (!item.productId) throw orderError(409, 'ORDER_PRODUCT_MISSING', `El producto ${item.productName || ''} ya no puede licenciarse.`);
      const periodEnd = nextPeriodEnd(item.productSnapshot?.billingInterval || 'one_time', now);
      for (let unit = 1; unit <= Number(item.quantity); unit += 1) {
        const externalRef = `order:${order.uuid}:${item.uuid}:${unit}`;
        const license = await models.UserLicense.create({
          userId: Number(userId),
          productId: item.productId,
          status: 'ACTIVE',
          quantity: 1,
          sourceType: 'store_order',
          externalRef,
          startsAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          metadata: {
            orderUuid: order.uuid,
            orderItemUuid: item.uuid,
            unit,
            provider: cleanProvider,
            paymentRef: cleanPaymentRef,
            productKey: item.productKey,
            productName: item.productName,
            priceCents: Number(item.priceCents),
            currency: item.currency
          }
        }, { transaction });
        licenses.push(license);
      }
    }

    order.status = 'PAID';
    order.paymentProvider = cleanProvider;
    order.paymentRef = cleanPaymentRef;
    order.paidAt = now;
    order.metadata = {
      ...(order.metadata || {}),
      paidAt: now.toISOString(),
      payment: { provider: cleanProvider, reference: cleanPaymentRef }
    };
    await order.save({ transaction });

    let cartCleared = false;
    const cartRow = await models.UserSetting.findOne({ where: { userId: Number(userId), key: CART_KEY }, transaction });
    if (cartRow) {
      let currentItems = null;
      try { currentItems = JSON.parse(cartRow.value); } catch { currentItems = null; }
      if (sameCartItems(currentItems, order.metadata?.cartItems || [])) {
        await models.UserSetting.upsert({ userId: Number(userId), key: CART_KEY, value: '[]' }, { transaction });
        cartCleared = true;
      }
    }

    return { order, licenses, alreadyCompleted: false, cartCleared };
  });
}
