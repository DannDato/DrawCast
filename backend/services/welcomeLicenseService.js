import { models } from '../models/index.js';
import { STORE_PRODUCT_KEYS } from '../bootstrap/catalogs/store.js';

export const WELCOME_PLUS_DAYS = 14;

export function welcomePlusEndsAt(startsAt = new Date()) {
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  return new Date(start.getTime() + WELCOME_PLUS_DAYS * 24 * 60 * 60 * 1000);
}

export async function grantWelcomePlusLicense(user, transaction = undefined) {
  if (!user?.id || !user?.uuid) throw new Error('Usuario inválido para licencia de bienvenida.');

  const product = await models.StoreProduct.findOne({
    where: { key: STORE_PRODUCT_KEYS.CANVAS_PLUS, active: true },
    transaction
  });
  if (!product) throw new Error('Lienzo Plus no está disponible. Ejecuta npm run seed.');

  const externalRef = `welcome_plus:${user.uuid}`;
  const existing = await models.UserLicense.findOne({
    where: { sourceType: 'welcome_trial', externalRef },
    transaction
  });
  if (existing) return existing;

  const startsAt = new Date();
  const endsAt = welcomePlusEndsAt(startsAt);
  return models.UserLicense.create({
    userId: user.id,
    productId: product.id,
    status: 'ACTIVE',
    quantity: 1,
    sourceType: 'welcome_trial',
    externalRef,
    startsAt,
    currentPeriodStart: startsAt,
    currentPeriodEnd: endsAt,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    endsAt,
    metadata: { welcomeTrial: true, durationDays: WELCOME_PLUS_DAYS }
  }, { transaction });
}
