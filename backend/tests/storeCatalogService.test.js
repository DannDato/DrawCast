import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENTITLEMENT_BUNDLES, ENTITLEMENT_CAPABILITIES } from '../bootstrap/catalogs/entitlements.js';
import { STORE_PRODUCTS } from '../bootstrap/catalogs/store.js';
import { models } from '../models/index.js';
import { bootstrapStoreCatalog, publicStoreProduct, requirementsSatisfied, storeProductCommerceState, storeProductIsPubliclyPurchasable, storeProductIsStackable, validateStoreCatalogDefinitions } from '../services/storeCatalogService.js';

test('el catálogo de tienda referencia bundles/capabilities existentes y scopes compatibles', () => {
  assert.equal(validateStoreCatalogDefinitions(STORE_PRODUCTS, ENTITLEMENT_BUNDLES, ENTITLEMENT_CAPABILITIES), true);
});

test('Lienzo Plus es el producto principal y concede canvas.plus', () => {
  const plus = STORE_PRODUCTS.find((product) => product.key === 'canvas.plus');
  assert.ok(plus);
  assert.equal(plus.featured, true);
  assert.equal(plus.targetScope, 'channel');
  assert.equal(plus.priceCents, 9900);
  assert.deepEqual(plus.bundles, ['canvas.plus']);
});


test('Licencia Collab existe como producto administrativo permanente y no comprable', () => {
  const collab = STORE_PRODUCTS.find((product) => product.key === 'canvas.collab');
  assert.ok(collab);
  assert.equal(collab.targetScope, 'channel');
  assert.equal(collab.billingInterval, 'one_time');
  assert.equal(collab.priceCents, 0);
  assert.deepEqual(collab.bundles, ['canvas.collab']);
  assert.equal(collab.metadata?.storeVisible, false);
  assert.equal(collab.metadata?.adminOnly, true);
  assert.equal(storeProductIsPubliclyPurchasable(collab), false);
});

test('las expansiones están modeladas como bundles add y pueden depender de Plus o feature base', () => {
  const guides = STORE_PRODUCTS.find((product) => product.key === 'addon.guide_slots.3');
  assert.ok(guides);
  assert.equal(guides.kind, 'addon');
  assert.ok(guides.requirements.some((row) => row.groupKey === 'plus' && row.subjectKey === 'canvas.plus'));
  assert.ok(guides.requirements.some((row) => row.groupKey === 'feature' && row.subjectKey === 'editor.guides'));

  const bundle = ENTITLEMENT_BUNDLES.find((row) => row.key === 'addon.guide_slots.3');
  assert.deepEqual(bundle?.grants?.['limit.guide_slots'], { operation: 'add', value: 3 });
});


test('+8 pads depende de la capability efectiva de Launchpad, no de un producto concreto', () => {
  const product = STORE_PRODUCTS.find((row) => row.key === 'addon.launchpad_pads.8');
  const bundle = ENTITLEMENT_BUNDLES.find((row) => row.key === 'addon.launchpad_pads.8');
  const padsCapability = ENTITLEMENT_CAPABILITIES.find((row) => row.key === 'limit.launchpad_pads');

  assert.ok(product);
  assert.equal(product.kind, 'addon');
  assert.deepEqual(product.bundles, ['addon.launchpad_pads.8']);
  assert.deepEqual(product.requirements.map((row) => [row.subjectType, row.subjectKey, row.operator]), [
    ['capability', 'editor.launchpad', 'truthy']
  ]);
  assert.deepEqual(bundle?.grants?.['limit.launchpad_pads'], { operation: 'add', value: 8 });
  assert.equal(padsCapability?.expandable, true);
  assert.equal(padsCapability?.hardMax, 24);

  assert.equal(requirementsSatisfied(product.requirements, { features: { 'editor.launchpad': true }, bundles: [] }), true);
  assert.equal(requirementsSatisfied(product.requirements, { features: { 'editor.launchpad': false }, bundles: ['tool.launchpad'] }), false);
});

test('Nuevo lienzo vive en scope account y no depende de un channel', () => {
  const canvas = STORE_PRODUCTS.find((product) => product.key === 'account.canvas_slot.1');
  assert.ok(canvas);
  assert.equal(canvas.targetScope, 'account');
  assert.equal(canvas.priceCents, 6700);
  assert.deepEqual(canvas.bundles, ['account.canvas_slot.1']);
});


test('las herramientas Lite acordadas existen como productos independientes', () => {
  const expected = [
    ['tool.text', 'tool.text'],
    ['tool.shapes', 'tool.shapes'],
    ['tool.timer', 'tool.timer'],
    ['tool.guides', 'tool.guides'],
    ['tool.designs', 'tool.designs'],
    ['tool.quick_sounds', 'tool.quick_sounds'],
    ['tool.custom_sounds', 'tool.custom_sounds'],
    ['tool.launchpad', 'tool.launchpad'],
    ['tool.live_studio', 'tool.live_studio'],
    ['tool.remove_watermark', 'tool.remove_watermark']
  ];

  for (const [productKey, bundleKey] of expected) {
    const product = STORE_PRODUCTS.find((row) => row.key === productKey);
    assert.ok(product, `Falta ${productKey}`);
    assert.equal(product.kind, 'tool');
    assert.deepEqual(product.bundles, [bundleKey]);
  }
});

test('los Packs reales componen bundles existentes mediante N:M', () => {
  const expected = [
    ['pack.visual', ['tool.text', 'tool.shapes', 'tool.timer']],
    ['pack.creative', ['tool.guides', 'tool.designs']],
    ['pack.audio', ['tool.quick_sounds', 'tool.custom_sounds', 'tool.launchpad']]
  ];

  for (const [key, bundles] of expected) {
    const product = STORE_PRODUCTS.find((row) => row.key === key);
    assert.ok(product, `Falta ${key}`);
    assert.equal(product.kind, 'pack');
    assert.equal(product.targetScope, 'channel');
    assert.deepEqual(product.bundles, bundles);
    assert.equal(product.metadata?.section, 'packs');
  }
});

test('Launchpad Lite, Live/Studio y quitar watermark existen como productos independientes', () => {
  const launchpad = ENTITLEMENT_BUNDLES.find((row) => row.key === 'tool.launchpad');
  const liveStudio = ENTITLEMENT_BUNDLES.find((row) => row.key === 'tool.live_studio');
  const removeWatermark = ENTITLEMENT_BUNDLES.find((row) => row.key === 'tool.remove_watermark');
  const plus = ENTITLEMENT_BUNDLES.find((row) => row.key === 'canvas.plus');

  assert.equal(launchpad?.grants?.['editor.launchpad'], true);
  assert.equal(launchpad?.grants?.['limit.launchpad_pads'], 8);
  assert.equal(launchpad?.grants?.['editor.custom_sounds'], undefined);
  assert.equal(liveStudio?.grants?.['editor.live_studio'], true);
  assert.equal(removeWatermark?.grants?.['overlay.remove_watermark'], true);
  assert.equal(plus?.grants?.['limit.launchpad_pads'], 24);
});


test('publicStoreProduct normaliza metadata JSON serializado para la tienda', () => {
  const product = {
    uuid: '4d0b0ed1-975d-4a40-90c8-57236789fc15',
    key: 'tool.launchpad',
    kind: 'tool',
    targetScope: 'channel',
    name: 'Launchpad Lite',
    priceCents: 200,
    currency: 'MXN',
    billingInterval: 'month',
    featured: false,
    sortOrder: 150,
    metadata: JSON.stringify({ section: 'tools', icon: 'audio-lines', highlights: ['Launchpad', '8 pads'] }),
    bundleLinks: [],
    requirements: []
  };

  const serialized = publicStoreProduct(product);
  assert.equal(serialized.metadata.section, 'tools');
  assert.equal(serialized.metadata.icon, 'audio-lines');
  assert.deepEqual(serialized.metadata.highlights, ['Launchpad', '8 pads']);
});


test('requirements agrupa AND dentro de grupo y OR entre grupos', () => {
  const requirements = [
    { groupKey: 'plus', subjectType: 'bundle', subjectKey: 'canvas.plus', operator: 'active' },
    { groupKey: 'feature', subjectType: 'capability', subjectKey: 'editor.guides', operator: 'truthy' }
  ];

  assert.equal(requirementsSatisfied(requirements, { bundles: ['canvas.plus'], features: {} }), true);
  assert.equal(requirementsSatisfied(requirements, { bundles: [], features: { 'editor.guides': true } }), true);
  assert.equal(requirementsSatisfied(requirements, { bundles: [], features: { 'editor.guides': false } }), false);
});

test('requirements de límites soportan gte para futuras expansiones', () => {
  const requirements = [{ groupKey: 'limit', subjectType: 'capability', subjectKey: 'limit.layers', operator: 'gte', value: 10 }];
  assert.equal(requirementsSatisfied(requirements, { limits: { 'limit.layers': 10 } }), true);
  assert.equal(requirementsSatisfied(requirements, { limits: { 'limit.layers': 5 } }), false);
});



test('la inteligencia de tienda calcula redundancia por cobertura de lienzos, no por propiedad global', () => {
  const tool = { kind: 'tool', metadata: {}, requirements: [] };
  const addon = { kind: 'addon', metadata: {}, requirements: [{ groupKey: 'base' }] };
  const plan = { kind: 'plan', metadata: {}, requirements: [] };

  assert.equal(storeProductIsStackable(tool), false);
  assert.equal(storeProductIsStackable(addon), true);
  assert.equal(storeProductIsStackable(plan), true);

  assert.equal(storeProductCommerceState({
    product: tool,
    ownership: { activeLicenseCount: 1, activeAssignmentCount: 1 },
    requirementsMet: true,
    coverage: { ownedChannelCount: 1, coveredChannelCount: 1, plusCoveredChannelCount: 0 }
  }), 'owned_applied');

  // Tener la herramienta aplicada en A no impide comprar otra para B.
  assert.equal(storeProductCommerceState({
    product: tool,
    ownership: { activeLicenseCount: 1, activeAssignmentCount: 1 },
    requirementsMet: true,
    coverage: { ownedChannelCount: 2, coveredChannelCount: 1, plusCoveredChannelCount: 0 }
  }), 'available');

  // Una licencia libre debe usarse antes de vender otra.
  assert.equal(storeProductCommerceState({
    product: tool,
    ownership: { activeLicenseCount: 2, activeAssignmentCount: 1 },
    requirementsMet: true,
    coverage: { ownedChannelCount: 2, coveredChannelCount: 1, plusCoveredChannelCount: 0 }
  }), 'in_inventory');

  // Plus sólo hace redundante una herramienta cuando cubre todos los lienzos.
  assert.equal(storeProductCommerceState({
    product: tool,
    ownership: {},
    requirementsMet: true,
    coverage: { ownedChannelCount: 1, coveredChannelCount: 1, plusCoveredChannelCount: 1 }
  }), 'included_in_plus');
  assert.equal(storeProductCommerceState({
    product: tool,
    ownership: {},
    requirementsMet: true,
    coverage: { ownedChannelCount: 2, coveredChannelCount: 1, plusCoveredChannelCount: 1 }
  }), 'available');

  assert.equal(storeProductCommerceState({ product: addon, ownership: {}, requirementsMet: false, coverage: { ownedChannelCount: 1 } }), 'requires_base');
  assert.equal(storeProductCommerceState({ product: addon, ownership: {}, requirementsMet: true, coverage: { ownedChannelCount: 1 } }), 'available');
});

test('metadata.stackable puede sobreescribir el comportamiento por tipo para futura administración', () => {
  assert.equal(storeProductIsStackable({ kind: 'tool', metadata: { stackable: true } }), true);
  assert.equal(storeProductIsStackable({ kind: 'addon', metadata: { stackable: false } }), false);
});

test('seed sincroniza precio y moneda sin modificar otros campos y es idempotente', async (t) => {
  const transaction = {};
  let updates = 0;
  const products = new Map(STORE_PRODUCTS.map((definition, index) => [definition.key, {
    id: index + 1,
    priceCents: 1,
    currency: 'USD',
    name: 'Nombre personalizado',
    active: false,
    async update(values, options) {
      assert.deepEqual(Object.keys(values).sort(), ['currency', 'priceCents']);
      assert.equal(options.transaction, transaction);
      Object.assign(this, values);
      updates += 1;
    }
  }]));
  t.mock.method(models.EntitlementBundle, 'findAll', async () => ENTITLEMENT_BUNDLES.map((bundle, index) => ({ id: index + 1, key: bundle.key })));
  t.mock.method(models.StoreProduct, 'findOrCreate', async ({ where }) => [products.get(where.key), false]);
  t.mock.method(models.StoreProductBundle, 'findOrCreate', async () => [{}, false]);
  t.mock.method(models.StoreProductRequirement, 'findOrCreate', async () => [{}, false]);

  await bootstrapStoreCatalog({ transaction, syncPrices: true });
  assert.equal(updates, STORE_PRODUCTS.length);
  for (const definition of STORE_PRODUCTS) {
    const product = products.get(definition.key);
    assert.equal(product.priceCents, definition.priceCents);
    assert.equal(product.currency, 'MXN');
    assert.equal(product.name, 'Nombre personalizado');
    assert.equal(product.active, false);
  }
  await bootstrapStoreCatalog({ transaction, syncPrices: true });
  assert.equal(updates, STORE_PRODUCTS.length);
});

test('bootstrap de tienda completa relaciones faltantes sin reescribir productos existentes', async () => {
  const originals = {
    bundleFindAll: models.EntitlementBundle.findAll,
    productFindOrCreate: models.StoreProduct.findOrCreate,
    productBundleFindOrCreate: models.StoreProductBundle.findOrCreate,
    requirementFindOrCreate: models.StoreProductRequirement.findOrCreate
  };
  let bundleLinkCalls = 0;
  let requirementCalls = 0;

  try {
    models.EntitlementBundle.findAll = async () => ENTITLEMENT_BUNDLES.map((bundle, index) => ({ id: index + 1, key: bundle.key }));
    models.StoreProduct.findOrCreate = async ({ where }) => [{ id: where.key, key: where.key }, false];
    models.StoreProductBundle.findOrCreate = async () => { bundleLinkCalls += 1; return [{}, false]; };
    models.StoreProductRequirement.findOrCreate = async () => { requirementCalls += 1; return [{}, false]; };

    await bootstrapStoreCatalog();
    assert.equal(bundleLinkCalls, STORE_PRODUCTS.reduce((total, product) => total + product.bundles.length, 0));
    assert.equal(requirementCalls, STORE_PRODUCTS.reduce((total, product) => total + (product.requirements || []).length, 0));
  } finally {
    models.EntitlementBundle.findAll = originals.bundleFindAll;
    models.StoreProduct.findOrCreate = originals.productFindOrCreate;
    models.StoreProductBundle.findOrCreate = originals.productBundleFindOrCreate;
    models.StoreProductRequirement.findOrCreate = originals.requirementFindOrCreate;
  }
});
