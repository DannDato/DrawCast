import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENTITLEMENT_BUNDLES, ENTITLEMENT_CAPABILITIES } from '../config/entitlementCatalog.js';
import { STORE_PRODUCTS } from '../config/storeCatalog.js';
import { validateStoreCatalogDefinitions } from '../services/storeCatalogService.js';

test('el catálogo de tienda referencia bundles/capabilities existentes y scopes compatibles', () => {
  assert.equal(validateStoreCatalogDefinitions(STORE_PRODUCTS, ENTITLEMENT_BUNDLES, ENTITLEMENT_CAPABILITIES), true);
});

test('Lienzo Plus es el producto principal y concede canvas.plus', () => {
  const plus = STORE_PRODUCTS.find((product) => product.key === 'canvas.plus');
  assert.ok(plus);
  assert.equal(plus.featured, true);
  assert.equal(plus.targetScope, 'channel');
  assert.equal(plus.priceCents, 400);
  assert.deepEqual(plus.bundles, ['canvas.plus']);
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

test('Nuevo lienzo vive en scope account y no depende de un channel', () => {
  const canvas = STORE_PRODUCTS.find((product) => product.key === 'account.canvas_slot.1');
  assert.ok(canvas);
  assert.equal(canvas.targetScope, 'account');
  assert.equal(canvas.priceCents, 300);
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
    ['tool.custom_sounds', 'tool.custom_sounds']
  ];

  for (const [productKey, bundleKey] of expected) {
    const product = STORE_PRODUCTS.find((row) => row.key === productKey);
    assert.ok(product, `Falta ${productKey}`);
    assert.equal(product.kind, 'tool');
    assert.deepEqual(product.bundles, [bundleKey]);
  }
});

test('Launchpad y Live/Estudio siguen reservados a Lienzo Plus', () => {
  const standaloneBundles = ENTITLEMENT_BUNDLES.filter((row) => row.kind === 'tool');
  assert.equal(standaloneBundles.some((row) => row.grants?.['editor.launchpad'] === true), false);
  assert.equal(standaloneBundles.some((row) => row.grants?.['editor.live_studio'] === true), false);

  const plus = ENTITLEMENT_BUNDLES.find((row) => row.key === 'canvas.plus');
  assert.equal(plus?.grants?.['editor.launchpad'], true);
  assert.equal(plus?.grants?.['editor.live_studio'], true);
});
