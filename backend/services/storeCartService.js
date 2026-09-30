import { db, models } from '../models/index.js';
import { getStoreCatalogForUser, publicStoreProduct } from './storeCatalogService.js';
import { getStoreSettings } from './storeSettingsService.js';
import { cartError, cartQuantity, summarizeCart, validateCartReview } from './storeCartRules.js';

const CART_KEY = 'store.cart';

async function readItems(userId, transaction) {
  const row = await models.UserSetting.findOne({ where: { userId, key: CART_KEY }, transaction });
  if (!row) return [];
  const items = JSON.parse(row.value);
  if (!Array.isArray(items)) throw cartError(500, 'CART_INVALID', 'No se pudo leer el carrito.');
  return items;
}

function buildCart(items, entries) {
  const settings = getStoreSettings();
  return summarizeCart(items.map((item) => {
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
}

export async function getUserCart(userId) {
  const [items, { entries }] = await Promise.all([readItems(userId), getStoreCatalogForUser(userId)]);
  return buildCart(items, entries);
}

export async function changeUserCart(userId, { productUuid, quantity, action }) {
  if (typeof productUuid !== 'string' || !/^[a-f0-9-]{36}$/i.test(productUuid)) throw cartError(400, 'CART_PRODUCT_INVALID', 'El producto no es válido.');
  if (action !== 'remove') cartQuantity(quantity);

  return db.transaction(async (transaction) => {
    // Bloquear el usuario también serializa la primera creación del carrito.
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

export async function reviewUserCart(userId) {
  const cart = validateCartReview(await getUserCart(userId));
  return { ...cart, paymentAvailable: false };
}
