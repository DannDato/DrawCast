import crypto from 'node:crypto';
import { db, models } from '../models/index.js';
import {
  activeAssignmentsForLicense,
  activeSameProductAssignment,
  eligibleChannelUuids,
  findStoreProductByUuid,
  findUserLicenseByUuid,
  getOwnedChannelEligibility,
  getStoreCatalogForUser,
  ownedChannelByUuid
} from './storeCatalogService.js';
import { getChannelEntitlements, invalidateChannelEntitlements } from './channelEntitlementAccessService.js';

export function storeSimulationEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.STORE_SIMULATION_ENABLED !== 'false';
}

function storeError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function nextPeriodEnd(interval, from = new Date()) {
  if (interval === 'one_time') return null;
  const next = new Date(from);
  if (interval === 'year') next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export async function simulateStorePurchase(userId, productUuid, { acknowledgeUnmetRequirements = false } = {}) {
  if (!storeSimulationEnabled()) throw storeError(404, 'STORE_SIMULATION_DISABLED', 'La compra simulada no está disponible.');

  const product = await findStoreProductByUuid(String(productUuid || '').trim());
  if (!product) throw storeError(404, 'STORE_PRODUCT_NOT_FOUND', 'Producto no encontrado.');

  const { entries } = await getStoreCatalogForUser(userId);
  const catalogEntry = entries.find((entry) => Number(entry.product.id) === Number(product.id));
  const state = catalogEntry?.eligibility?.state || 'available';
  if (catalogEntry?.eligibility?.purchaseAvailable === false) {
    if (state === 'included_in_plus') throw storeError(409, 'STORE_PRODUCT_INCLUDED_IN_PLUS', 'Lienzo Plus ya incluye este producto.');
    throw storeError(409, 'STORE_PRODUCT_ALREADY_OWNED', 'Ya tienes este producto disponible en tu cuenta.');
  }

  const requirements = product.requirements || [];
  if (product.targetScope === 'channel' && requirements.length) {
    const contexts = await getOwnedChannelEligibility(userId);
    if (!eligibleChannelUuids(product, contexts).length && !acknowledgeUnmetRequirements) {
      throw storeError(409, 'STORE_REQUIREMENTS_CONFIRMATION_REQUIRED', 'No tienes un lienzo compatible con esta expansión. Confirma que deseas comprarla de todos modos.');
    }
  }

  const now = new Date();
  const periodEnd = nextPeriodEnd(product.billingInterval, now);
  const license = await models.UserLicense.create({
    userId: Number(userId),
    productId: product.id,
    status: 'ACTIVE',
    quantity: 1,
    sourceType: 'dev',
    externalRef: `dev:${crypto.randomUUID()}`,
    startsAt: now,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    metadata: { simulated: true, priceCents: Number(product.priceCents || 0), currency: product.currency }
  });

  return findUserLicenseByUuid(userId, license.uuid);
}

export async function assignLicenseToChannel(userId, licenseUuid, channelUuid) {
  const license = await findUserLicenseByUuid(userId, String(licenseUuid || '').trim());
  if (!license) throw storeError(404, 'LICENSE_NOT_FOUND', 'Licencia no encontrada.');
  if (String(license.status).toUpperCase() !== 'ACTIVE') throw storeError(409, 'LICENSE_NOT_ACTIVE', 'La licencia no está activa.');
  if (license.endsAt && new Date(license.endsAt) <= new Date()) throw storeError(409, 'LICENSE_NOT_ACTIVE', 'La licencia ya terminó.');

  const product = license.product;
  if (!product || product.targetScope !== 'channel') throw storeError(400, 'LICENSE_NOT_ASSIGNABLE', 'Esta mejora se aplica a la cuenta y no necesita un lienzo.');

  const channel = await ownedChannelByUuid(userId, String(channelUuid || '').trim());
  if (!channel) throw storeError(403, 'CHANNEL_NOT_OWNED', 'Sólo puedes aplicar tus licencias a lienzos de tu propiedad.');

  const contexts = await getOwnedChannelEligibility(userId);
  const allowed = new Set(eligibleChannelUuids(product, contexts));
  if (!allowed.has(channel.uuid)) throw storeError(409, 'STORE_REQUIREMENTS_NOT_MET', 'Este lienzo todavía no cumple los requisitos de la mejora.');

  const assignment = await db.transaction(async (transaction) => {
    const lockedLicense = await models.UserLicense.findOne({
      where: { id: license.id, userId: Number(userId), status: 'ACTIVE' },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!lockedLicense) throw storeError(409, 'LICENSE_NOT_ACTIVE', 'La licencia ya no está activa.');

    const lockedChannel = await models.Channel.findOne({
      where: { id: channel.id, ownerId: Number(userId) },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!lockedChannel) throw storeError(403, 'CHANNEL_NOT_OWNED', 'Sólo puedes aplicar tus licencias a lienzos de tu propiedad.');

    const activeCount = await activeAssignmentsForLicense(license.id, transaction);
    if (activeCount >= Math.max(1, Number(lockedLicense.quantity || 1))) throw storeError(409, 'LICENSE_ALREADY_ASSIGNED', 'Esta licencia ya está asignada.');

    if (product.kind !== 'addon') {
      const duplicate = await activeSameProductAssignment(product.id, channel.id, transaction);
      if (duplicate) throw storeError(409, 'PRODUCT_ALREADY_ACTIVE', 'Este producto ya está activo en ese lienzo.');
    }

    const created = await models.LicenseAssignment.create({
      licenseId: license.id,
      channelId: channel.id,
      status: 'ACTIVE',
      assignedAt: new Date(),
      metadata: { source: license.sourceType }
    }, { transaction });

    for (const link of product.bundleLinks || []) {
      const bundle = link.bundle;
      if (!bundle || bundle.scope !== 'channel') continue;
      await models.ChannelEntitlement.create({
        channelId: channel.id,
        bundleId: bundle.id,
        sourceType: 'license',
        sourceRef: `assignment:${created.uuid}`,
        status: 'ACTIVE',
        startsAt: license.startsAt || new Date(),
        endsAt: license.endsAt || null,
        metadata: { licenseUuid: license.uuid, productKey: product.key }
      }, { transaction });
    }

    return created;
  });

  invalidateChannelEntitlements(channel.id);
  const entitlements = await getChannelEntitlements(channel.id, { fresh: true });
  const updatedLicense = await findUserLicenseByUuid(userId, license.uuid);
  return { assignment, channel, entitlements, license: updatedLicense };
}

export async function releaseLicenseAssignment(userId, licenseUuid, assignmentUuid) {
  const license = await findUserLicenseByUuid(userId, String(licenseUuid || '').trim());
  if (!license) throw storeError(404, 'LICENSE_NOT_FOUND', 'Licencia no encontrada.');

  const product = license.product;
  if (!product || product.targetScope !== 'channel') throw storeError(400, 'LICENSE_NOT_ASSIGNABLE', 'Esta mejora se aplica a la cuenta y no tiene asignación de lienzo.');

  const releasedAt = new Date();
  const result = await db.transaction(async (transaction) => {
    const lockedLicense = await models.UserLicense.findOne({
      where: { id: license.id, userId: Number(userId) },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!lockedLicense) throw storeError(404, 'LICENSE_NOT_FOUND', 'Licencia no encontrada.');

    const assignment = await models.LicenseAssignment.findOne({
      where: {
        uuid: String(assignmentUuid || '').trim(),
        licenseId: license.id,
        status: 'ACTIVE'
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!assignment) throw storeError(404, 'LICENSE_ASSIGNMENT_NOT_FOUND', 'La licencia ya no está aplicada a ese lienzo.');

    const channel = await models.Channel.findOne({
      where: { id: assignment.channelId, ownerId: Number(userId) },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!channel) throw storeError(403, 'CHANNEL_NOT_OWNED', 'Sólo puedes retirar licencias de lienzos de tu propiedad.');

    await assignment.update({ status: 'RELEASED', releasedAt }, { transaction });
    await models.ChannelEntitlement.update(
      { status: 'RELEASED', endsAt: releasedAt },
      {
        where: {
          channelId: channel.id,
          sourceType: 'license',
          sourceRef: `assignment:${assignment.uuid}`,
          status: 'ACTIVE'
        },
        transaction
      }
    );

    return { assignment, channel };
  });

  invalidateChannelEntitlements(result.channel.id);
  const entitlements = await getChannelEntitlements(result.channel.id, { fresh: true });
  const updatedLicense = await findUserLicenseByUuid(userId, license.uuid);
  return { assignment: result.assignment, channel: result.channel, entitlements, license: updatedLicense };
}
