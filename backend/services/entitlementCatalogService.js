import { Op } from 'sequelize';
import { models } from '../models/index.js';
import { ENTITLEMENT_BUNDLE_KEYS, ENTITLEMENT_BUNDLES, ENTITLEMENT_CAPABILITIES } from '../bootstrap/catalogs/entitlements.js';

function decodeJsonValue(value) {
  let current = value;
  for (let i = 0; i < 3 && typeof current === 'string'; i += 1) {
    try { current = JSON.parse(current); } catch { return current; }
  }
  return current;
}

function rowValue(row, key) {
  if (row && typeof row.get === 'function') return row.get(key);
  return row?.[key];
}

function normalizeCapabilityValue(capability, value) {
  const valueType = rowValue(capability, 'valueType');
  if (valueType === 'boolean') return Boolean(value);
  if (valueType !== 'integer') return value;

  let number = Number(value);
  if (!Number.isFinite(number)) number = 0;
  number = Math.trunc(number);

  const hardMin = rowValue(capability, 'hardMin');
  const hardMax = rowValue(capability, 'hardMax');
  if (Number.isInteger(Number(hardMin))) number = Math.max(number, Number(hardMin));
  if (hardMax != null && Number.isInteger(Number(hardMax))) number = Math.min(number, Number(hardMax));
  return number;
}


function normalizeGrantDefinition(definition) {
  if (definition && typeof definition === 'object' && !Array.isArray(definition) && Object.hasOwn(definition, 'value')) {
    return { operation: definition.operation || 'set', value: definition.value };
  }
  return { operation: 'set', value: definition };
}

function defaultCapabilityValue(capability) {
  return rowValue(capability, 'valueType') === 'boolean' ? false : 0;
}

function grantsForBundle(bundle) {
  const grants = rowValue(bundle, 'grants');
  return Array.isArray(grants) ? grants : [];
}

export function validateEntitlementCatalogDefinitions(capabilities = ENTITLEMENT_CAPABILITIES, bundles = ENTITLEMENT_BUNDLES) {
  const capabilityKeys = new Set();
  const bundleKeys = new Set();

  for (const capability of capabilities) {
    if (!capability?.key || capabilityKeys.has(capability.key)) throw new Error(`Capability inválida o duplicada: ${capability?.key || '(vacía)'}`);
    if (!['account', 'channel'].includes(capability.scope)) throw new Error(`Scope inválido en ${capability.key}`);
    if (!['boolean', 'integer'].includes(capability.valueType)) throw new Error(`valueType inválido en ${capability.key}`);
    if (capability.expandable && capability.valueType !== 'integer') throw new Error(`Sólo los límites enteros pueden ser expandibles: ${capability.key}`);
    if (capability.hardMax != null && capability.valueType !== 'integer') throw new Error(`hardMax sólo aplica a límites enteros: ${capability.key}`);
    capabilityKeys.add(capability.key);
  }

  const capabilityByKey = new Map(capabilities.map((capability) => [capability.key, capability]));
  for (const bundle of bundles) {
    if (!bundle?.key || bundleKeys.has(bundle.key)) throw new Error(`Bundle inválido o duplicado: ${bundle?.key || '(vacío)'}`);
    if (!['account', 'channel'].includes(bundle.scope)) throw new Error(`Scope inválido en ${bundle.key}`);
    bundleKeys.add(bundle.key);

    for (const [capabilityKey, grantDefinition] of Object.entries(bundle.grants || {})) {
      const capability = capabilityByKey.get(capabilityKey);
      if (!capability) throw new Error(`Bundle ${bundle.key} referencia capability inexistente: ${capabilityKey}`);
      if (capability.scope !== bundle.scope) throw new Error(`Scope incompatible entre ${bundle.key} y ${capabilityKey}`);
      const { operation, value } = normalizeGrantDefinition(grantDefinition);
      if (!['set', 'add'].includes(operation)) throw new Error(`Operación inválida en ${bundle.key}:${capabilityKey}`);
      if (operation === 'add' && (!capability.expandable || capability.valueType !== 'integer')) throw new Error(`Sólo límites expandibles aceptan add: ${bundle.key}:${capabilityKey}`);
      if (capability.valueType === 'boolean' && typeof value !== 'boolean') throw new Error(`Valor booleano inválido en ${bundle.key}:${capabilityKey}`);
      if (capability.valueType === 'integer' && (!Number.isInteger(value) || value < 0)) throw new Error(`Valor entero inválido en ${bundle.key}:${capabilityKey}`);
    }
  }

  return true;
}

export function resolveEntitlementValues(capabilities, bundles) {
  const activeCapabilities = (capabilities || []).filter((capability) => rowValue(capability, 'active') !== false);
  const capabilityById = new Map(activeCapabilities.map((capability) => [Number(rowValue(capability, 'id')), capability]));
  const capabilityByKey = new Map(activeCapabilities.map((capability) => [rowValue(capability, 'key'), capability]));
  const values = Object.fromEntries(activeCapabilities.map((capability) => [rowValue(capability, 'key'), defaultCapabilityValue(capability)]));

  const orderedBundles = [...(bundles || [])]
    .filter((bundle) => rowValue(bundle, 'active') !== false)
    .sort((left, right) => Number(rowValue(left, 'priority') || 0) - Number(rowValue(right, 'priority') || 0));

  for (const bundle of orderedBundles) {
    for (const grant of grantsForBundle(bundle)) {
      let capability = rowValue(grant, 'capability');
      if (!capability) capability = capabilityById.get(Number(rowValue(grant, 'capabilityId')));
      if (!capability) capability = capabilityByKey.get(rowValue(grant, 'capabilityKey'));
      if (!capability || rowValue(capability, 'active') === false) continue;

      const key = rowValue(capability, 'key');
      const operation = rowValue(grant, 'operation') || 'set';
      const rawValue = decodeJsonValue(rowValue(grant, 'value'));
      const nextValue = normalizeCapabilityValue(capability, rawValue);

      if (operation === 'add') {
        if (rowValue(capability, 'valueType') !== 'integer' || !rowValue(capability, 'expandable')) continue;
        values[key] = normalizeCapabilityValue(capability, Number(values[key] || 0) + Number(nextValue || 0));
      } else if (operation === 'set') {
        values[key] = nextValue;
      }
    }
  }

  const features = {};
  const limits = {};
  for (const capability of activeCapabilities) {
    const key = rowValue(capability, 'key');
    if (rowValue(capability, 'valueType') === 'boolean') features[key] = Boolean(values[key]);
    else limits[key] = Number(values[key] || 0);
  }

  return {
    values,
    features,
    limits,
    bundles: orderedBundles.map((bundle) => rowValue(bundle, 'key')).filter(Boolean)
  };
}

// Bootstrap de instalación: crea faltantes y nunca reescribe configuración ya persistida.
export async function bootstrapEntitlementCatalog({ transaction } = {}) {
  validateEntitlementCatalogDefinitions();
  const capabilityRows = new Map();

  for (const definition of ENTITLEMENT_CAPABILITIES) {
    const defaults = {
      ...definition,
      hardMin: definition.valueType === 'integer' ? (definition.hardMin ?? 0) : null,
      hardMax: definition.hardMax ?? null,
      active: true,
      system: true,
      metadata: definition.metadata ?? null
    };
    const [row] = await models.EntitlementCapability.findOrCreate({ where: { key: definition.key }, defaults, transaction });
    capabilityRows.set(definition.key, row);
  }

  for (const definition of ENTITLEMENT_BUNDLES) {
    const bundleDefaults = {
      key: definition.key,
      scope: definition.scope,
      kind: definition.kind,
      name: definition.name,
      description: definition.description || null,
      priority: Number(definition.priority || 0),
      active: true,
      system: true,
      metadata: definition.metadata ?? null
    };
    const [bundle] = await models.EntitlementBundle.findOrCreate({ where: { key: definition.key }, defaults: bundleDefaults, transaction });

    // La BD sigue siendo la fuente de verdad: nunca reescribimos grants existentes.
    // Pero si una versión nueva introduce una capability/grant faltante en un bundle
    // de sistema ya persistido, sí creamos únicamente esa relación ausente.
    for (const [capabilityKey, grantDefinition] of Object.entries(definition.grants || {})) {
      const capability = capabilityRows.get(capabilityKey);
      const { operation, value } = normalizeGrantDefinition(grantDefinition);
      await models.EntitlementGrant.findOrCreate({
        where: { bundleId: bundle.id, capabilityId: capability.id },
        defaults: { operation, value },
        transaction
      });
    }
  }
}

function assignmentIsActive(assignment, at) {
  if (String(rowValue(assignment, 'status') || '').toUpperCase() !== 'ACTIVE') return false;
  const startsAt = rowValue(assignment, 'startsAt');
  const endsAt = rowValue(assignment, 'endsAt');
  if (startsAt && new Date(startsAt).getTime() > at.getTime()) return false;
  if (endsAt && new Date(endsAt).getTime() <= at.getTime()) return false;
  return true;
}

export function filterValidLicenseEntitlements(assignments = [], licenseAssignments = [], at = new Date()) {
  const allowedBundlesBySourceRef = new Map();

  for (const assignment of licenseAssignments || []) {
    if (String(rowValue(assignment, 'status') || '').toUpperCase() !== 'ACTIVE') continue;
    const license = rowValue(assignment, 'license');
    if (!licenseIsActive(license, at)) continue;
    const product = rowValue(license, 'product');
    if (!product || rowValue(product, 'active') === false) continue;

    const allowed = new Set();
    for (const link of rowValue(product, 'bundleLinks') || []) {
      const bundle = rowValue(link, 'bundle');
      if (!bundle || rowValue(bundle, 'active') === false || rowValue(bundle, 'scope') !== 'channel') continue;
      allowed.add(Number(rowValue(bundle, 'id')));
    }
    allowedBundlesBySourceRef.set(`assignment:${rowValue(assignment, 'uuid')}`, allowed);
  }

  return (assignments || []).filter((assignment) => {
    if (String(rowValue(assignment, 'sourceType') || '').toLowerCase() !== 'license') return true;
    const sourceRef = String(rowValue(assignment, 'sourceRef') || '');
    const allowed = allowedBundlesBySourceRef.get(sourceRef);
    return Boolean(allowed?.has(Number(rowValue(assignment, 'bundleId'))));
  });
}

async function loadActiveLicenseAssignments(channelId, sourceRefs, at) {
  const uuids = [...new Set((sourceRefs || [])
    .map((sourceRef) => String(sourceRef || ''))
    .filter((sourceRef) => sourceRef.startsWith('assignment:'))
    .map((sourceRef) => sourceRef.slice('assignment:'.length))
    .filter(Boolean))];
  if (!uuids.length) return [];

  return models.LicenseAssignment.findAll({
    where: { channelId: Number(channelId), status: 'ACTIVE', uuid: { [Op.in]: uuids } },
    include: [{
      model: models.UserLicense,
      as: 'license',
      required: true,
      include: [{
        model: models.StoreProduct,
        as: 'product',
        required: true,
        include: [{
          model: models.StoreProductBundle,
          as: 'bundleLinks',
          include: [{ model: models.EntitlementBundle, as: 'bundle', required: true }]
        }]
      }]
    }]
  });
}

async function loadBundleByKey(key) {
  return models.EntitlementBundle.findOne({
    where: { key, active: true },
    include: [{
      model: models.EntitlementGrant,
      as: 'grants',
      include: [{ model: models.EntitlementCapability, as: 'capability', where: { active: true }, required: true }]
    }]
  });
}

export async function resolveChannelEntitlements(channelId, { at = new Date() } = {}) {
  const [baseline, assignments] = await Promise.all([
    loadBundleByKey(ENTITLEMENT_BUNDLE_KEYS.CANVAS_FREE),
    models.ChannelEntitlement.findAll({
      where: { channelId: Number(channelId), status: 'ACTIVE' },
      include: [{
        model: models.EntitlementBundle,
        as: 'bundle',
        where: { active: true, scope: 'channel' },
        required: true,
        include: [{
          model: models.EntitlementGrant,
          as: 'grants',
          include: [{ model: models.EntitlementCapability, as: 'capability', where: { active: true }, required: true }]
        }]
      }]
    })
  ]);

  if (!baseline) throw new Error('El catálogo de entitlements no está inicializado. Ejecuta npm run seed.');

  const activeAssignments = assignments.filter((assignment) => assignmentIsActive(assignment, at) && assignment.bundle);
  const licenseSourceRefs = activeAssignments
    .filter((assignment) => String(rowValue(assignment, 'sourceType') || '').toLowerCase() === 'license')
    .map((assignment) => rowValue(assignment, 'sourceRef'));
  const licenseAssignments = await loadActiveLicenseAssignments(channelId, licenseSourceRefs, at);
  const validAssignments = filterValidLicenseEntitlements(activeAssignments, licenseAssignments, at);

  const activeBundles = [baseline, ...validAssignments.map((assignment) => assignment.bundle)];

  const capabilities = await models.EntitlementCapability.findAll({ where: { scope: 'channel', active: true } });
  return resolveEntitlementValues(capabilities, activeBundles);
}

function licenseIsActive(license, at) {
  if (String(rowValue(license, 'status') || '').toUpperCase() !== 'ACTIVE') return false;
  const startsAt = rowValue(license, 'startsAt');
  const endsAt = rowValue(license, 'endsAt');
  if (startsAt && new Date(startsAt).getTime() > at.getTime()) return false;
  if (endsAt && new Date(endsAt).getTime() <= at.getTime()) return false;
  return true;
}

export async function resolveAccountEntitlements(userId, { at = new Date() } = {}) {
  const [baseline, licenses] = await Promise.all([
    loadBundleByKey(ENTITLEMENT_BUNDLE_KEYS.ACCOUNT_FREE),
    models.UserLicense.findAll({
      where: { userId: Number(userId), status: 'ACTIVE' },
      include: [{
        model: models.StoreProduct,
        as: 'product',
        where: { active: true, targetScope: 'account' },
        required: true,
        include: [{
          model: models.StoreProductBundle,
          as: 'bundleLinks',
          include: [{
            model: models.EntitlementBundle,
            as: 'bundle',
            where: { active: true, scope: 'account' },
            required: true,
            include: [{
              model: models.EntitlementGrant,
              as: 'grants',
              include: [{ model: models.EntitlementCapability, as: 'capability', where: { active: true }, required: true }]
            }]
          }]
        }]
      }]
    })
  ]);

  if (!baseline) throw new Error('El catálogo de entitlements no está inicializado. Ejecuta npm run seed.');

  const activeBundles = [baseline];
  for (const license of licenses) {
    if (!licenseIsActive(license, at) || !license.product) continue;
    const quantity = Math.max(1, Number(rowValue(license, 'quantity') || 1));
    const links = rowValue(license.product, 'bundleLinks') || [];
    for (let copy = 0; copy < quantity; copy += 1) {
      for (const link of links) {
        const bundle = rowValue(link, 'bundle');
        if (bundle) activeBundles.push(bundle);
      }
    }
  }

  const capabilities = await models.EntitlementCapability.findAll({ where: { scope: 'account', active: true } });
  return resolveEntitlementValues(capabilities, activeBundles);
}

export async function getEntitlementCatalogSnapshot() {
  const capabilities = await models.EntitlementCapability.findAll({ order: [['scope', 'ASC'], ['sortOrder', 'ASC'], ['key', 'ASC']] });
  const bundles = await models.EntitlementBundle.findAll({
    include: [{
      model: models.EntitlementGrant,
      as: 'grants',
      include: [{ model: models.EntitlementCapability, as: 'capability' }]
    }],
    order: [['scope', 'ASC'], ['priority', 'ASC'], ['key', 'ASC']]
  });
  return { capabilities, bundles };
}
