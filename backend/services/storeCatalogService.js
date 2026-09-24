import { models } from '../models/index.js';
import { ENTITLEMENT_BUNDLES, ENTITLEMENT_CAPABILITIES } from '../config/entitlementCatalog.js';
import { STORE_PRODUCTS } from '../config/storeCatalog.js';

function rowValue(row, key) {
  if (row && typeof row.get === 'function') return row.get(key);
  return row?.[key];
}

export function validateStoreCatalogDefinitions(products = STORE_PRODUCTS, bundles = ENTITLEMENT_BUNDLES, capabilities = ENTITLEMENT_CAPABILITIES) {
  const productKeys = new Set();
  const bundleKeys = new Set(bundles.map((bundle) => bundle.key));
  const capabilityKeys = new Set(capabilities.map((capability) => capability.key));

  for (const product of products) {
    if (!product?.key || productKeys.has(product.key)) throw new Error(`Producto de tienda inválido o duplicado: ${product?.key || '(vacío)'}`);
    if (!['plan', 'tool', 'addon', 'capacity'].includes(product.kind)) throw new Error(`kind inválido en ${product.key}`);
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

export async function seedStoreCatalog({ transaction, overwriteSystemDefaults = false } = {}) {
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

    const [product, created] = await models.StoreProduct.findOrCreate({ where: { key: definition.key }, defaults, transaction });
    if (!created) {
      const patch = overwriteSystemDefaults ? defaults : {
        name: definition.name,
        description: definition.description || null,
        badge: definition.badge || null,
        featured: Boolean(definition.featured),
        sortOrder: Number(definition.sortOrder || 0),
        metadata: definition.metadata || null,
        system: true
      };
      await product.update(patch, { transaction });
    }

    const expectedBundleIds = [];
    for (const bundleKey of definition.bundles) {
      const bundle = bundleByKey.get(bundleKey);
      if (!bundle) throw new Error(`No se encontró el bundle ${bundleKey}. Ejecuta primero seedEntitlementCatalog.`);
      expectedBundleIds.push(Number(bundle.id));
      await models.StoreProductBundle.findOrCreate({ where: { productId: product.id, bundleId: bundle.id }, defaults: {}, transaction });
    }

    const expectedRequirementSignatures = new Set();
    for (const requirement of definition.requirements || []) {
      const signature = `${requirement.groupKey}:${requirement.subjectType}:${requirement.subjectKey}:${requirement.operator}`;
      expectedRequirementSignatures.add(signature);
      const [row, requirementCreated] = await models.StoreProductRequirement.findOrCreate({
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
      if (!requirementCreated && overwriteSystemDefaults) await row.update({ value: requirement.value ?? null, description: requirement.description || null }, { transaction });
      else if (!requirementCreated) await row.update({ description: requirement.description || row.description || null }, { transaction });
    }

    if (overwriteSystemDefaults) {
      const currentLinks = await models.StoreProductBundle.findAll({ where: { productId: product.id }, transaction });
      for (const link of currentLinks) if (!expectedBundleIds.includes(Number(link.bundleId))) await link.destroy({ transaction });

      const currentRequirements = await models.StoreProductRequirement.findAll({ where: { productId: product.id }, transaction });
      for (const requirement of currentRequirements) {
        const signature = `${requirement.groupKey}:${requirement.subjectType}:${requirement.subjectKey}:${requirement.operator}`;
        if (!expectedRequirementSignatures.has(signature)) await requirement.destroy({ transaction });
      }
    }
  }
}

export async function getStoreCatalog() {
  return models.StoreProduct.findAll({
    where: { active: true },
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    include: [
      {
        model: models.StoreProductBundle,
        as: 'bundleLinks',
        include: [{ model: models.EntitlementBundle, as: 'bundle', attributes: ['key', 'name', 'kind', 'scope'] }]
      },
      { model: models.StoreProductRequirement, as: 'requirements' }
    ]
  });
}

export function publicStoreProduct(product) {
  const metadata = rowValue(product, 'metadata') || {};
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
    requirements
  };
}

export async function getUserLicenses(userId) {
  return models.UserLicense.findAll({
    where: { userId: Number(userId) },
    order: [['createdAt', 'DESC']],
    include: [
      { model: models.StoreProduct, as: 'product' },
      { model: models.LicenseAssignment, as: 'assignments', include: [{ model: models.Channel, as: 'channel', attributes: ['uuid', 'name'] }] }
    ]
  });
}

export function publicUserLicense(license) {
  const product = rowValue(license, 'product');
  return {
    uuid: rowValue(license, 'uuid'),
    status: rowValue(license, 'status'),
    quantity: Number(rowValue(license, 'quantity') || 1),
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
    }))
  };
}
