import { Op } from 'sequelize';
import { models } from '../models/index.js';
import { ENTITLEMENT_BUNDLES, ENTITLEMENT_CAPABILITIES } from '../bootstrap/catalogs/entitlements.js';
import { STORE_PRODUCTS } from '../bootstrap/catalogs/store.js';
import { resolveChannelEntitlements } from './entitlementCatalogService.js';

function rowValue(row, key) {
  if (row && typeof row.get === 'function') return row.get(key);
  return row?.[key];
}

function productIncludes() {
  return [
    {
      model: models.StoreProductBundle,
      as: 'bundleLinks',
      include: [{ model: models.EntitlementBundle, as: 'bundle', attributes: ['id', 'key', 'name', 'kind', 'scope'] }]
    },
    { model: models.StoreProductRequirement, as: 'requirements' }
  ];
}

export function validateStoreCatalogDefinitions(products = STORE_PRODUCTS, bundles = ENTITLEMENT_BUNDLES, capabilities = ENTITLEMENT_CAPABILITIES) {
  const productKeys = new Set();
  const bundleKeys = new Set(bundles.map((bundle) => bundle.key));
  const capabilityKeys = new Set(capabilities.map((capability) => capability.key));

  for (const product of products) {
    if (!product?.key || productKeys.has(product.key)) throw new Error(`Producto de tienda inválido o duplicado: ${product?.key || '(vacío)'}`);
    if (!['plan', 'tool', 'pack', 'addon', 'capacity'].includes(product.kind)) throw new Error(`kind inválido en ${product.key}`);
    if (!['account', 'channel'].includes(product.targetScope)) throw new Error(`targetScope inválido en ${product.key}`);
    if (!Number.isInteger(product.priceCents) || product.priceCents < 0) throw new Error(`priceCents inválido en ${product.key}`);
    if (String(product.currency || '').length !== 3) throw new Error(`currency inválida en ${product.key}`);
    if (!['month', 'year', 'one_time'].includes(product.billingInterval)) throw new Error(`billingInterval inválido en ${product.key}`);
    if (!Array.isArray(product.bundles) || product.bundles.length === 0) throw new Error(`Producto sin bundles: ${product.key}`);

    for (const bundleKey of product.bundles) {
      if (!bundleKeys.has(bundleKey)) throw new Error(`Producto ${product.key} referencia bundle inexistente: ${bundleKey}`);
      const bundle = bundles.find((candidate) => candidate.key === bundleKey);
      if (bundle?.scope !== product.targetScope) throw new Error(`Scope incompatible entre ${product.key} y ${bundleKey}`);
    }

    const groups = new Map();
    for (const requirement of product.requirements || []) {
      if (!requirement?.groupKey) throw new Error(`Requirement sin groupKey en ${product.key}`);
      if (!['bundle', 'capability', 'product'].includes(requirement.subjectType)) throw new Error(`subjectType inválido en ${product.key}`);
      if (!['active', 'truthy', 'eq', 'gte'].includes(requirement.operator)) throw new Error(`operator inválido en ${product.key}`);
      if (requirement.subjectType === 'bundle' && !bundleKeys.has(requirement.subjectKey)) throw new Error(`Requirement de bundle inexistente en ${product.key}: ${requirement.subjectKey}`);
      if (requirement.subjectType === 'capability' && !capabilityKeys.has(requirement.subjectKey)) throw new Error(`Requirement de capability inexistente en ${product.key}: ${requirement.subjectKey}`);
      if (requirement.subjectType === 'product' && !products.some((candidate) => candidate.key === requirement.subjectKey)) throw new Error(`Requirement de producto inexistente en ${product.key}: ${requirement.subjectKey}`);
      if (!groups.has(requirement.groupKey)) groups.set(requirement.groupKey, []);
      groups.get(requirement.groupKey).push(requirement);
    }

    productKeys.add(product.key);
  }

  return true;
}

// Bootstrap de instalación: la BD pasa a ser la fuente de verdad en cuanto el producto existe.
export async function bootstrapStoreCatalog({ transaction } = {}) {
  validateStoreCatalogDefinitions();
  const bundles = await models.EntitlementBundle.findAll({ transaction });
  const bundleByKey = new Map(bundles.map((bundle) => [bundle.key, bundle]));

  for (const definition of STORE_PRODUCTS) {
    const defaults = {
      key: definition.key,
      kind: definition.kind,
      targetScope: definition.targetScope,
      name: definition.name,
      description: definition.description || null,
      priceCents: definition.priceCents,
      currency: definition.currency,
      billingInterval: definition.billingInterval,
      badge: definition.badge || null,
      featured: Boolean(definition.featured),
      active: true,
      system: true,
      sortOrder: Number(definition.sortOrder || 0),
      metadata: definition.metadata || null
    };

    const [product] = await models.StoreProduct.findOrCreate({ where: { key: definition.key }, defaults, transaction });

    // No reescribimos nombre/precio/metadata de productos existentes. Sólo completamos
    // relaciones N:M o requisitos que una versión nueva haya añadido y todavía falten.
    for (const bundleKey of definition.bundles) {
      const bundle = bundleByKey.get(bundleKey);
      if (!bundle) throw new Error(`No se encontró el bundle ${bundleKey}. Ejecuta primero bootstrapEntitlementCatalog.`);
      await models.StoreProductBundle.findOrCreate({ where: { productId: product.id, bundleId: bundle.id }, defaults: {}, transaction });
    }

    for (const requirement of definition.requirements || []) {
      await models.StoreProductRequirement.findOrCreate({
        where: {
          productId: product.id,
          groupKey: requirement.groupKey,
          subjectType: requirement.subjectType,
          subjectKey: requirement.subjectKey,
          operator: requirement.operator
        },
        defaults: { value: requirement.value ?? null, description: requirement.description || null },
        transaction
      });
    }
  }
}

export async function getStoreCatalog() {
  return models.StoreProduct.findAll({
    where: { active: true },
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    include: productIncludes()
  });
}

export function publicStoreProduct(product, extras = {}) {
  const rawMetadata = decodeJsonValue(rowValue(product, 'metadata'));
  const metadata = rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata) ? rawMetadata : {};
  const requirements = (rowValue(product, 'requirements') || []).map((requirement) => ({
    groupKey: rowValue(requirement, 'groupKey'),
    subjectType: rowValue(requirement, 'subjectType'),
    subjectKey: rowValue(requirement, 'subjectKey'),
    operator: rowValue(requirement, 'operator'),
    value: rowValue(requirement, 'value') ?? null,
    description: rowValue(requirement, 'description') || null
  }));

  return {
    uuid: rowValue(product, 'uuid'),
    key: rowValue(product, 'key'),
    kind: rowValue(product, 'kind'),
    targetScope: rowValue(product, 'targetScope'),
    name: rowValue(product, 'name'),
    description: rowValue(product, 'description') || '',
    priceCents: Number(rowValue(product, 'priceCents') || 0),
    currency: rowValue(product, 'currency'),
    billingInterval: rowValue(product, 'billingInterval'),
    badge: rowValue(product, 'badge') || null,
    featured: Boolean(rowValue(product, 'featured')),
    sortOrder: Number(rowValue(product, 'sortOrder') || 0),
    metadata,
    bundles: (rowValue(product, 'bundleLinks') || []).map((link) => {
      const bundle = rowValue(link, 'bundle');
      return bundle ? { key: rowValue(bundle, 'key'), name: rowValue(bundle, 'name'), kind: rowValue(bundle, 'kind'), scope: rowValue(bundle, 'scope') } : null;
    }).filter(Boolean),
    requirements,
    ...extras
  };
}

function capabilityValue(entitlements, key) {
  if (Object.hasOwn(entitlements?.features || {}, key)) return entitlements.features[key];
  if (Object.hasOwn(entitlements?.limits || {}, key)) return entitlements.limits[key];
  return undefined;
}

function decodeJsonValue(value) {
  let current = value;
  for (let i = 0; i < 2 && typeof current === 'string'; i += 1) {
    try { current = JSON.parse(current); } catch { return current; }
  }
  return current;
}

function decodeRequirementValue(value) {
  return decodeJsonValue(value);
}

export function requirementsSatisfied(requirements = [], entitlements = {}, activeProductKeys = []) {
  if (!requirements.length) return true;
  const groups = new Map();
  for (const requirement of requirements) {
    const groupKey = rowValue(requirement, 'groupKey') || 'default';
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(requirement);
  }

  const bundles = new Set(entitlements?.bundles || []);
  const products = new Set(activeProductKeys || []);
  const matches = (requirement) => {
    const subjectType = rowValue(requirement, 'subjectType');
    const subjectKey = rowValue(requirement, 'subjectKey');
    const operator = rowValue(requirement, 'operator') || 'active';
    const expected = decodeRequirementValue(rowValue(requirement, 'value'));
    let actual;

    if (subjectType === 'bundle') actual = bundles.has(subjectKey);
    else if (subjectType === 'product') actual = products.has(subjectKey);
    else actual = capabilityValue(entitlements, subjectKey);

    if (operator === 'active' || operator === 'truthy') return Boolean(actual);
    if (operator === 'eq') return actual === expected;
    if (operator === 'gte') return Number(actual) >= Number(expected);
    return false;
  };

  // Los grupos son OR. Dentro de cada grupo, todas las condiciones son AND.
  return [...groups.values()].some((group) => group.every(matches));
}

async function activeProductKeysForChannel(channelId) {
  const rows = await models.LicenseAssignment.findAll({
    where: { channelId: Number(channelId), status: 'ACTIVE' },
    include: [{
      model: models.UserLicense,
      as: 'license',
      where: {
        status: 'ACTIVE',
        [Op.and]: [
          { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: new Date() } }] },
          { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: new Date() } }] }
        ]
      },
      required: true,
      include: [{ model: models.StoreProduct, as: 'product', where: { active: true }, required: true, attributes: ['key'] }]
    }]
  });
  return rows.map((row) => row.license?.product?.key).filter(Boolean);
}

export async function getOwnedChannelEligibility(userId) {
  const channels = await models.Channel.findAll({ where: { ownerId: Number(userId) }, attributes: ['id', 'uuid', 'name'], order: [['createdAt', 'ASC']] });
  return Promise.all(channels.map(async (channel) => ({
    channel,
    entitlements: await resolveChannelEntitlements(channel.id),
    activeProductKeys: await activeProductKeysForChannel(channel.id)
  })));
}

export function eligibleChannelUuids(product, channelContexts = []) {
  if (rowValue(product, 'targetScope') !== 'channel') return [];
  const requirements = rowValue(product, 'requirements') || [];
  return channelContexts
    .filter((context) => requirementsSatisfied(requirements, context.entitlements, context.activeProductKeys))
    .map((context) => context.channel.uuid);
}

function productMetadata(product) {
  const metadata = decodeJsonValue(rowValue(product, 'metadata'));
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

export function storeProductIsStackable(product) {
  const metadata = productMetadata(product);
  if (typeof metadata.stackable === 'boolean') return metadata.stackable;
  return ['addon', 'capacity', 'plan'].includes(rowValue(product, 'kind'));
}

export function storeProductCommerceState({ product, ownership = {}, requirementsMet = true, plusOwned = false }) {
  const kind = rowValue(product, 'kind');
  const activeLicenseCount = Number(ownership.activeLicenseCount || 0);
  const activeAssignmentCount = Number(ownership.activeAssignmentCount || 0);
  const stackable = storeProductIsStackable(product);

  if (!stackable && activeAssignmentCount > 0) return 'owned_applied';
  if (!stackable && activeLicenseCount > activeAssignmentCount) return 'in_inventory';
  if (plusOwned && ['tool', 'pack'].includes(kind)) return 'included_in_plus';
  if (!requirementsMet && (rowValue(product, 'requirements') || []).length > 0) return 'requires_base';
  return 'available';
}

async function activeLicenseOwnershipForUser(userId) {
  const now = new Date();
  const licenses = await models.UserLicense.findAll({
    where: {
      userId: Number(userId),
      status: 'ACTIVE',
      [Op.and]: [
        { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }] },
        { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now } }] }
      ]
    },
    include: [
      { model: models.StoreProduct, as: 'product', where: { active: true }, required: true, attributes: ['id', 'key', 'kind', 'metadata'] },
      { model: models.LicenseAssignment, as: 'assignments', where: { status: 'ACTIVE' }, required: false, attributes: ['id', 'channelId'] }
    ]
  });

  const ownership = new Map();
  for (const license of licenses) {
    const product = rowValue(license, 'product');
    const key = rowValue(product, 'key');
    if (!key) continue;
    if (!ownership.has(key)) ownership.set(key, { activeLicenseCount: 0, activeAssignmentCount: 0 });
    const summary = ownership.get(key);
    summary.activeLicenseCount += Math.max(1, Number(rowValue(license, 'quantity') || 1));
    summary.activeAssignmentCount += (rowValue(license, 'assignments') || []).length;
  }
  return ownership;
}

export async function getStoreCatalogForUser(userId) {
  const [products, channelContexts, ownership] = await Promise.all([
    getStoreCatalog(),
    getOwnedChannelEligibility(userId),
    activeLicenseOwnershipForUser(userId)
  ]);

  const plusProduct = products.find((product) => rowValue(product, 'featured') && rowValue(product, 'kind') === 'plan') || null;
  const plusKey = rowValue(plusProduct, 'key');
  const plusOwnership = plusKey ? (ownership.get(plusKey) || {}) : {};
  const plusOwned = Number(plusOwnership.activeLicenseCount || 0) > 0;
  const plusAppliedChannelCount = plusKey
    ? channelContexts.filter((context) => context.activeProductKeys.includes(plusKey)).length
    : 0;
  const plusApplied = plusAppliedChannelCount > 0;

  const entries = products.map((product) => {
    const requirements = rowValue(product, 'requirements') || [];
    const eligible = eligibleChannelUuids(product, channelContexts);
    const requirementsMet = rowValue(product, 'targetScope') === 'account' || requirements.length === 0 || eligible.length > 0;
    const productOwnership = ownership.get(rowValue(product, 'key')) || {};
    const state = storeProductCommerceState({ product, ownership: productOwnership, requirementsMet, plusOwned });
    const purchaseAvailable = !['owned_applied', 'in_inventory', 'included_in_plus'].includes(state);

    return {
      product,
      eligibility: {
        purchaseAvailable,
        state,
        requirementsMet,
        requiresConfirmation: state === 'requires_base',
        eligibleChannelCount: eligible.length,
        ownedChannelCount: channelContexts.length,
        activeLicenseCount: Number(productOwnership.activeLicenseCount || 0),
        activeAssignmentCount: Number(productOwnership.activeAssignmentCount || 0),
        stackable: storeProductIsStackable(product)
      }
    };
  });

  return {
    entries,
    intelligence: {
      plusProductKey: plusKey || null,
      plusProductName: rowValue(plusProduct, 'name') || null,
      plusOwned,
      plusApplied,
      plusActiveLicenseCount: Number(plusOwnership.activeLicenseCount || 0),
      plusAppliedChannelCount
    }
  };
}

export async function getUserLicenses(userId) {
  return models.UserLicense.findAll({
    where: { userId: Number(userId) },
    order: [['createdAt', 'DESC']],
    include: [
      { model: models.StoreProduct, as: 'product', include: productIncludes() },
      { model: models.LicenseAssignment, as: 'assignments', include: [{ model: models.Channel, as: 'channel', attributes: ['uuid', 'name'] }] }
    ]
  });
}

export async function getUserInventory(userId) {
  const [licenses, channelContexts] = await Promise.all([getUserLicenses(userId), getOwnedChannelEligibility(userId)]);
  return licenses.map((license) => ({
    license,
    eligibleChannelUuids: eligibleChannelUuids(license.product, channelContexts)
  }));
}

export function publicUserLicense(license, extras = {}) {
  const product = rowValue(license, 'product');
  return {
    uuid: rowValue(license, 'uuid'),
    status: rowValue(license, 'status'),
    quantity: Number(rowValue(license, 'quantity') || 1),
    sourceType: rowValue(license, 'sourceType'),
    startsAt: rowValue(license, 'startsAt') || null,
    currentPeriodStart: rowValue(license, 'currentPeriodStart') || null,
    currentPeriodEnd: rowValue(license, 'currentPeriodEnd') || null,
    cancelAtPeriodEnd: Boolean(rowValue(license, 'cancelAtPeriodEnd')),
    endsAt: rowValue(license, 'endsAt') || null,
    product: product ? publicStoreProduct(product) : null,
    assignments: (rowValue(license, 'assignments') || []).map((assignment) => ({
      uuid: rowValue(assignment, 'uuid'),
      status: rowValue(assignment, 'status'),
      assignedAt: rowValue(assignment, 'assignedAt'),
      releasedAt: rowValue(assignment, 'releasedAt') || null,
      channel: rowValue(assignment, 'channel') ? {
        uuid: rowValue(rowValue(assignment, 'channel'), 'uuid'),
        name: rowValue(rowValue(assignment, 'channel'), 'name')
      } : null
    })),
    ...extras
  };
}

export async function findStoreProductByUuid(productUuid) {
  return models.StoreProduct.findOne({ where: { uuid: productUuid, active: true }, include: productIncludes() });
}

export async function findUserLicenseByUuid(userId, licenseUuid) {
  return models.UserLicense.findOne({
    where: { uuid: licenseUuid, userId: Number(userId) },
    include: [
      { model: models.StoreProduct, as: 'product', required: true, include: productIncludes() },
      { model: models.LicenseAssignment, as: 'assignments', include: [{ model: models.Channel, as: 'channel', attributes: ['uuid', 'name'] }] }
    ]
  });
}

export async function ownedChannelByUuid(userId, channelUuid) {
  return models.Channel.findOne({ where: { uuid: channelUuid, ownerId: Number(userId) } });
}

export async function activeAssignmentsForLicense(licenseId, transaction = undefined) {
  return models.LicenseAssignment.count({ where: { licenseId: Number(licenseId), status: 'ACTIVE' }, transaction });
}

export async function activeSameProductAssignment(productId, channelId, transaction = undefined) {
  return models.LicenseAssignment.findOne({
    where: { channelId: Number(channelId), status: 'ACTIVE' },
    include: [{
      model: models.UserLicense,
      as: 'license',
      where: { productId: Number(productId), status: 'ACTIVE' },
      required: true
    }],
    transaction
  });
}

export async function countActiveLicensesForUser(userId) {
  return models.UserLicense.count({
    where: {
      userId: Number(userId),
      status: 'ACTIVE',
      [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: new Date() } }]
    }
  });
}
