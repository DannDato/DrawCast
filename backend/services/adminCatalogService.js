import { Op } from 'sequelize';
import { db, models } from '../models/index.js';
import { invalidateAllChannelEntitlements } from './channelEntitlementAccessService.js';

const PRODUCT_KINDS = new Set(['plan', 'tool', 'pack', 'addon', 'capacity']);
const SCOPES = new Set(['account', 'channel']);
const BILLING = new Set(['month', 'year', 'one_time']);
const GRANT_OPS = new Set(['set', 'add']);

function cleanText(value, max, { nullable = false } = {}) {
  const text = String(value ?? '').trim().slice(0, max);
  return nullable && !text ? null : text;
}

function decodeJson(value) {
  let current = value;
  for (let i = 0; i < 2 && typeof current === 'string'; i += 1) {
    try { current = JSON.parse(current); } catch { return current; }
  }
  return current;
}

function serializeCapability(row) {
  return {
    key: row.key,
    scope: row.scope,
    valueType: row.valueType,
    category: row.category,
    name: row.name,
    description: row.description || '',
    expandable: Boolean(row.expandable),
    hardMin: row.hardMin == null ? null : Number(row.hardMin),
    hardMax: row.hardMax == null ? null : Number(row.hardMax),
    active: Boolean(row.active)
  };
}

function serializeBundle(row) {
  return {
    key: row.key,
    scope: row.scope,
    kind: row.kind,
    name: row.name,
    description: row.description || '',
    priority: Number(row.priority || 0),
    active: Boolean(row.active),
    system: Boolean(row.system),
    grants: (row.grants || []).map((grant) => ({
      capabilityKey: grant.capability?.key,
      capabilityName: grant.capability?.name || grant.capability?.key,
      valueType: grant.capability?.valueType,
      operation: grant.operation,
      value: decodeJson(grant.value)
    })).filter((grant) => grant.capabilityKey)
  };
}

function serializeProduct(row) {
  const metadata = decodeJson(row.metadata) || {};
  const bundles = (row.bundleLinks || []).map((link) => link.bundle).filter(Boolean).map(serializeBundle);
  return {
    uuid: row.uuid,
    key: row.key,
    kind: row.kind,
    category: row.kind === 'pack' ? 'packages' : row.kind === 'addon' ? 'expansions' : 'licenses',
    targetScope: row.targetScope,
    name: row.name,
    description: row.description || '',
    priceCents: Number(row.priceCents || 0),
    price: Number(row.priceCents || 0) / 100,
    currency: row.currency,
    billingInterval: row.billingInterval,
    badge: row.badge || '',
    featured: Boolean(row.featured),
    active: Boolean(row.active),
    system: Boolean(row.system),
    sortOrder: Number(row.sortOrder || 0),
    storeVisible: metadata.storeVisible !== false && metadata.adminOnly !== true,
    metadata,
    bundles
  };
}

const includes = [{
  model: models.StoreProductBundle,
  as: 'bundleLinks',
  include: [{
    model: models.EntitlementBundle,
    as: 'bundle',
    include: [{
      model: models.EntitlementGrant,
      as: 'grants',
      include: [{ model: models.EntitlementCapability, as: 'capability' }]
    }]
  }]
}];

export async function getAdminCatalog() {
  const [products, capabilities, bundles] = await Promise.all([
    models.StoreProduct.findAll({ include: includes, order: [['sortOrder', 'ASC'], ['name', 'ASC']] }),
    models.EntitlementCapability.findAll({ where: { active: true }, order: [['scope', 'ASC'], ['category', 'ASC'], ['sortOrder', 'ASC']] }),
    models.EntitlementBundle.findAll({ where: { active: true }, include: [{ model: models.EntitlementGrant, as: 'grants', include: [{ model: models.EntitlementCapability, as: 'capability' }] }], order: [['scope', 'ASC'], ['priority', 'ASC'], ['name', 'ASC']] })
  ]);
  return {
    products: products.map(serializeProduct),
    capabilities: capabilities.map(serializeCapability),
    bundles: bundles.map((bundle) => ({ key: bundle.key, scope: bundle.scope, kind: bundle.kind, name: bundle.name, grants: serializeBundle(bundle).grants }))
  };
}

function normalizeGrantValue(capability, value, operation) {
  if (capability.valueType === 'boolean') {
    if (operation !== 'set') throw Object.assign(new Error('Las capacidades booleanas sólo aceptan operación set.'), { status: 400 });
    return Boolean(value);
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) throw Object.assign(new Error(`${capability.name} debe ser un entero mayor o igual a 0.`), { status: 400 });
  if (operation === 'add' && !capability.expandable) throw Object.assign(new Error(`${capability.name} no acepta expansiones aditivas.`), { status: 400 });
  if (capability.hardMin != null && numeric < Number(capability.hardMin)) throw Object.assign(new Error(`${capability.name} no puede ser menor a ${capability.hardMin}.`), { status: 400 });
  if (capability.hardMax != null && numeric > Number(capability.hardMax)) throw Object.assign(new Error(`${capability.name} no puede superar ${capability.hardMax}.`), { status: 400 });
  return numeric;
}

async function syncBundleLinks(product, bundleKeys, transaction) {
  if (!Array.isArray(bundleKeys) || bundleKeys.length === 0) throw Object.assign(new Error('El producto debe tener al menos un paquete de capacidades.'), { status: 400 });
  const bundles = await models.EntitlementBundle.findAll({ where: { key: bundleKeys }, transaction });
  if (bundles.length !== new Set(bundleKeys).size) throw Object.assign(new Error('Uno o más paquetes de capacidades no existen.'), { status: 400 });
  if (bundles.some((bundle) => bundle.scope !== product.targetScope)) throw Object.assign(new Error('El scope del producto y sus paquetes debe coincidir.'), { status: 400 });
  await models.StoreProductBundle.destroy({ where: { productId: product.id }, transaction });
  await models.StoreProductBundle.bulkCreate(bundles.map((bundle) => ({ productId: product.id, bundleId: bundle.id })), { transaction });
}

async function upsertGrants(bundle, grants, transaction) {
  if (!Array.isArray(grants)) return;
  const capabilities = await models.EntitlementCapability.findAll({ where: { key: grants.map((grant) => grant.capabilityKey), active: true }, transaction });
  const byKey = new Map(capabilities.map((capability) => [capability.key, capability]));
  const keepIds = [];
  for (const input of grants) {
    const capability = byKey.get(String(input.capabilityKey || ''));
    if (!capability) throw Object.assign(new Error(`Capability no encontrada: ${input.capabilityKey}`), { status: 400 });
    if (capability.scope !== bundle.scope) throw Object.assign(new Error(`Scope incompatible para ${capability.name}.`), { status: 400 });
    const operation = GRANT_OPS.has(input.operation) ? input.operation : 'set';
    const value = normalizeGrantValue(capability, input.value, operation);
    const [grant] = await models.EntitlementGrant.findOrCreate({
      where: { bundleId: bundle.id, capabilityId: capability.id },
      defaults: { operation, value },
      transaction
    });
    await grant.update({ operation, value }, { transaction });
    keepIds.push(grant.id);
  }
  await models.EntitlementGrant.destroy({ where: { bundleId: bundle.id, ...(keepIds.length ? { id: { [Op.notIn]: keepIds } } : {}) }, transaction });
}

function productPatch(body, existing = null) {
  const kind = body.kind ?? existing?.kind;
  const targetScope = body.targetScope ?? existing?.targetScope;
  const billingInterval = body.billingInterval ?? existing?.billingInterval;
  if (!PRODUCT_KINDS.has(kind)) throw Object.assign(new Error('Tipo de producto inválido.'), { status: 400 });
  if (!SCOPES.has(targetScope)) throw Object.assign(new Error('Scope inválido.'), { status: 400 });
  if (!BILLING.has(billingInterval)) throw Object.assign(new Error('Intervalo de cobro inválido.'), { status: 400 });
  const name = cleanText(body.name ?? existing?.name, 120);
  if (!name) throw Object.assign(new Error('El nombre del producto es obligatorio.'), { status: 400 });
  const priceCents = body.priceCents == null ? Number(existing?.priceCents || 0) : Number(body.priceCents);
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 100000000) throw Object.assign(new Error('Precio inválido.'), { status: 400 });
  const currency = cleanText(body.currency ?? existing?.currency ?? 'MXN', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw Object.assign(new Error('Moneda inválida.'), { status: 400 });
  return {
    kind,
    targetScope,
    name,
    description: cleanText(body.description ?? existing?.description, 320, { nullable: true }),
    priceCents,
    currency,
    billingInterval,
    badge: cleanText(body.badge ?? existing?.badge, 80, { nullable: true }),
    featured: body.featured == null ? Boolean(existing?.featured) : Boolean(body.featured),
    active: body.active == null ? (existing ? Boolean(existing.active) : true) : Boolean(body.active),
    sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : Number(existing?.sortOrder || 0)
  };
}

export async function updateAdminCatalogProduct(uuid, body) {
  await db.transaction(async (transaction) => {
    const product = await models.StoreProduct.findOne({ where: { uuid }, transaction });
    if (!product) throw Object.assign(new Error('Producto no encontrado.'), { status: 404 });
    const patch = productPatch(body, product);
    const currentMetadata = decodeJson(product.metadata) || {};
    const metadata = { ...currentMetadata, ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}) };
    if (typeof body.storeVisible === 'boolean') metadata.storeVisible = body.storeVisible;
    await product.update({ ...patch, metadata }, { transaction });
    if (Array.isArray(body.bundleKeys)) await syncBundleLinks(product, body.bundleKeys, transaction);
    if (body.bundleGrants && typeof body.bundleGrants === 'object') {
      const linked = await models.EntitlementBundle.findAll({
        include: [{ model: models.StoreProductBundle, as: 'storeProductLinks', where: { productId: product.id }, required: true }],
        transaction
      });
      const linkedByKey = new Map(linked.map((bundle) => [bundle.key, bundle]));
      for (const [bundleKey, grants] of Object.entries(body.bundleGrants)) {
        const bundle = linkedByKey.get(bundleKey);
        if (!bundle) throw Object.assign(new Error(`El producto no contiene el paquete ${bundleKey}.`), { status: 400 });
        await upsertGrants(bundle, grants, transaction);
      }
    }
  });
  invalidateAllChannelEntitlements();
  const catalog = await getAdminCatalog();
  return catalog.products.find((product) => product.uuid === uuid);
}

export async function createAdminCatalogProduct(body) {
  let createdUuid;
  await db.transaction(async (transaction) => {
    const key = cleanText(body.key, 120).toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,119}$/.test(key)) throw Object.assign(new Error('Usa una key técnica válida (ej. addon.layers.10).'), { status: 400 });
    if (await models.StoreProduct.findOne({ where: { key }, transaction })) throw Object.assign(new Error('Ya existe un producto con esa key.'), { status: 409 });
    const patch = productPatch(body);
    const metadata = { ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}), storeVisible: body.storeVisible !== false };
    const product = await models.StoreProduct.create({ ...patch, key, system: false, metadata }, { transaction });
    createdUuid = product.uuid;

    let bundleKeys = Array.isArray(body.bundleKeys) ? body.bundleKeys.filter(Boolean) : [];
    if (!bundleKeys.length) {
      const bundleKey = cleanText(body.bundleKey || key, 120).toLowerCase();
      const [bundle, created] = await models.EntitlementBundle.findOrCreate({
        where: { key: bundleKey },
        defaults: { key: bundleKey, scope: patch.targetScope, kind: patch.kind, name: patch.name, description: patch.description, priority: 100, active: true, system: false },
        transaction
      });
      if (!created && bundle.scope !== patch.targetScope) throw Object.assign(new Error('La key de bundle ya existe con otro scope.'), { status: 409 });
      bundleKeys = [bundle.key];
      if (Array.isArray(body.grants) && (created || body.grants.length > 0)) await upsertGrants(bundle, body.grants, transaction);
    }
    await syncBundleLinks(product, bundleKeys, transaction);
  });
  invalidateAllChannelEntitlements();
  const catalog = await getAdminCatalog();
  return catalog.products.find((product) => product.uuid === createdUuid);
}

export async function disableAdminCatalogProduct(uuid) {
  const product = await models.StoreProduct.findOne({ where: { uuid } });
  if (!product) throw Object.assign(new Error('Producto no encontrado.'), { status: 404 });
  await product.update({ active: false });
  invalidateAllChannelEntitlements();
  return true;
}
