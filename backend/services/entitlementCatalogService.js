import { models } from '../models/index.js';
import { ENTITLEMENT_BUNDLE_KEYS, ENTITLEMENT_BUNDLES, ENTITLEMENT_CAPABILITIES } from '../config/entitlementCatalog.js';

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

export async function seedEntitlementCatalog({ transaction, overwriteSystemDefaults = false } = {}) {
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
    const [row, created] = await models.EntitlementCapability.findOrCreate({ where: { key: definition.key }, defaults, transaction });
    if (!created) {
      const patch = overwriteSystemDefaults ? defaults : {
        name: definition.name,
        description: definition.description || null,
        category: definition.category,
        sortOrder: definition.sortOrder || 0,
        system: true
      };
      await row.update(patch, { transaction });
    }
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
    const [bundle, created] = await models.EntitlementBundle.findOrCreate({ where: { key: definition.key }, defaults: bundleDefaults, transaction });
    if (!created) {
      const patch = overwriteSystemDefaults ? bundleDefaults : {
        name: definition.name,
        description: definition.description || null,
        system: true
      };
      await bundle.update(patch, { transaction });
    }

    const expectedCapabilityIds = [];
    for (const [capabilityKey, grantDefinition] of Object.entries(definition.grants || {})) {
      const capability = capabilityRows.get(capabilityKey);
      const { operation, value } = normalizeGrantDefinition(grantDefinition);
      expectedCapabilityIds.push(capability.id);
      const [grant, created] = await models.EntitlementGrant.findOrCreate({
        where: { bundleId: bundle.id, capabilityId: capability.id },
        defaults: { operation, value },
        transaction
      });
      if (!created && overwriteSystemDefaults) await grant.update({ operation, value }, { transaction });
    }

    if (overwriteSystemDefaults) {
      const existingGrants = await models.EntitlementGrant.findAll({ where: { bundleId: bundle.id }, transaction });
      for (const grant of existingGrants) {
        if (!expectedCapabilityIds.includes(Number(grant.capabilityId))) await grant.destroy({ transaction });
      }
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

  const bundleByKey = new Map([[baseline.key, baseline]]);
  for (const assignment of assignments) {
    if (!assignmentIsActive(assignment, at) || !assignment.bundle) continue;
    bundleByKey.set(assignment.bundle.key, assignment.bundle);
  }

  const capabilities = await models.EntitlementCapability.findAll({ where: { scope: 'channel', active: true } });
  return resolveEntitlementValues(capabilities, [...bundleByKey.values()]);
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
