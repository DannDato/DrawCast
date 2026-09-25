import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENTITLEMENT_BUNDLES, ENTITLEMENT_CAPABILITIES } from '../bootstrap/catalogs/entitlements.js';
import { models } from '../models/index.js';
import { bootstrapEntitlementCatalog, filterValidLicenseEntitlements, resolveEntitlementValues, validateEntitlementCatalogDefinitions } from '../services/entitlementCatalogService.js';

function capability(key, valueType, { expandable = false, hardMax = null } = {}) {
  return { id: key, key, valueType, expandable, hardMin: valueType === 'integer' ? 0 : null, hardMax, active: true };
}

function grant(capabilityRef, value, operation = 'set') {
  return { capability: capabilityRef, value, operation };
}

test('el catálogo V1 es consistente y no mezcla scopes o tipos', () => {
  assert.equal(validateEntitlementCatalogDefinitions(ENTITLEMENT_CAPABILITIES, ENTITLEMENT_BUNDLES), true);
});

test('Free y Plus se resuelven por prioridad sin depender del usuario colaborador', () => {
  const text = capability('editor.text', 'boolean');
  const guides = capability('editor.guides', 'boolean');
  const layers = capability('limit.layers', 'integer', { expandable: true });
  const free = { key: 'canvas.free', priority: 0, active: true, grants: [grant(text, false), grant(guides, false), grant(layers, 5)] };
  const plus = { key: 'canvas.plus', priority: 100, active: true, grants: [grant(text, true), grant(guides, true), grant(layers, 5)] };

  const resolved = resolveEntitlementValues([text, guides, layers], [plus, free]);
  assert.equal(resolved.features['editor.text'], true);
  assert.equal(resolved.features['editor.guides'], true);
  assert.equal(resolved.limits['limit.layers'], 5);
  assert.deepEqual(resolved.bundles, ['canvas.free', 'canvas.plus']);
});

test('los packs futuros pueden sumar límites sin duplicar reglas del Editor', () => {
  const guideSlots = capability('limit.guide_slots', 'integer', { expandable: true, hardMax: 12 });
  const plus = { key: 'canvas.plus', priority: 100, active: true, grants: [grant(guideSlots, 3)] };
  const packA = { key: 'addon.guides.3.a', priority: 200, active: true, grants: [grant(guideSlots, 3, 'add')] };
  const packB = { key: 'addon.guides.3.b', priority: 200, active: true, grants: [grant(guideSlots, 3, 'add')] };

  assert.equal(resolveEntitlementValues([guideSlots], [plus, packA]).limits['limit.guide_slots'], 6);
  assert.equal(resolveEntitlementValues([guideSlots], [plus, packA, packB]).limits['limit.guide_slots'], 9);
});

test('hardMax limita acumulaciones aunque existan muchas expansiones', () => {
  const customSounds = capability('limit.custom_sound_slots', 'integer', { expandable: true, hardMax: 10 });
  const base = { key: 'canvas.plus', priority: 100, active: true, grants: [grant(customSounds, 5)] };
  const addon = { key: 'addon.sounds.50', priority: 200, active: true, grants: [grant(customSounds, 50, 'add')] };
  assert.equal(resolveEntitlementValues([customSounds], [base, addon]).limits['limit.custom_sound_slots'], 10);
});

test('un límite no expandible ignora grants add', () => {
  const pads = capability('limit.launchpad_pads', 'integer', { expandable: false, hardMax: 24 });
  const base = { key: 'canvas.plus', priority: 100, active: true, grants: [grant(pads, 24)] };
  const invalidAddon = { key: 'addon.launchpad', priority: 200, active: true, grants: [grant(pads, 8, 'add')] };
  assert.equal(resolveEntitlementValues([pads], [base, invalidAddon]).limits['limit.launchpad_pads'], 24);
});


test('Lienzo Free conserva marca de agua y Lienzo Plus la puede retirar', () => {
  const free = ENTITLEMENT_BUNDLES.find((bundle) => bundle.key === 'canvas.free');
  const plus = ENTITLEMENT_BUNDLES.find((bundle) => bundle.key === 'canvas.plus');
  const capability = ENTITLEMENT_CAPABILITIES.find((item) => item.key === 'overlay.remove_watermark');

  assert.ok(capability);
  assert.equal(capability.valueType, 'boolean');
  assert.equal(free?.grants?.['overlay.remove_watermark'], false);
  assert.equal(plus?.grants?.['overlay.remove_watermark'], true);
});


test('dos licencias del mismo addon se acumulan de forma independiente', () => {
  const guideSlots = capability('limit.guide_slots', 'integer', { expandable: true, hardMax: 20 });
  const plus = { key: 'canvas.plus', priority: 100, active: true, grants: [grant(guideSlots, 3)] };
  const sameAddon = { key: 'addon.guide_slots.3', priority: 200, active: true, grants: [grant(guideSlots, 3, 'add')] };
  const resolved = resolveEntitlementValues([guideSlots], [plus, sameAddon, sameAddon]);
  assert.equal(resolved.limits['limit.guide_slots'], 9);
});


test('Launchpad Lite resuelve 8 pads, las expansiones acumulan y el máximo técnico es 24', () => {
  const feature = capability('editor.launchpad', 'boolean');
  const pads = capability('limit.launchpad_pads', 'integer', { expandable: true, hardMax: 24 });
  const free = { key: 'canvas.free', priority: 0, active: true, grants: [grant(feature, false), grant(pads, 0)] };
  const lite = { key: 'tool.launchpad', priority: 50, active: true, grants: [grant(feature, true), grant(pads, 8)] };
  const plus = { key: 'canvas.plus', priority: 100, active: true, grants: [grant(feature, true), grant(pads, 24)] };

  const liteResolved = resolveEntitlementValues([feature, pads], [free, lite]);
  assert.equal(liteResolved.features['editor.launchpad'], true);
  assert.equal(liteResolved.limits['limit.launchpad_pads'], 8);

  const addon = { key: 'addon.launchpad_pads.8', priority: 200, active: true, grants: [grant(pads, 8, 'add')] };
  const sixteenPads = resolveEntitlementValues([feature, pads], [free, lite, addon]);
  assert.equal(sixteenPads.limits['limit.launchpad_pads'], 16);

  const twentyFourPads = resolveEntitlementValues([feature, pads], [free, lite, addon, addon]);
  assert.equal(twentyFourPads.limits['limit.launchpad_pads'], 24);

  const cappedPads = resolveEntitlementValues([feature, pads], [free, lite, addon, addon, addon]);
  assert.equal(cappedPads.limits['limit.launchpad_pads'], 24);

  const plusResolved = resolveEntitlementValues([feature, pads], [free, lite, plus, addon]);
  assert.equal(plusResolved.limits['limit.launchpad_pads'], 24);
});


test('bootstrap de entitlements no reescribe catálogo existente ni reconstruye grants', async () => {
  const originals = {
    capabilityFindOrCreate: models.EntitlementCapability.findOrCreate,
    bundleFindOrCreate: models.EntitlementBundle.findOrCreate,
    grantFindOrCreate: models.EntitlementGrant.findOrCreate
  };
  let capabilityId = 0;
  let grantCalls = 0;

  try {
    models.EntitlementCapability.findOrCreate = async ({ where }) => [{ id: ++capabilityId, key: where.key }, false];
    models.EntitlementBundle.findOrCreate = async ({ where }) => [{ id: where.key, key: where.key }, false];
    models.EntitlementGrant.findOrCreate = async () => { grantCalls += 1; return [{}, true]; };

    await bootstrapEntitlementCatalog();
    assert.equal(grantCalls, 0);
  } finally {
    models.EntitlementCapability.findOrCreate = originals.capabilityFindOrCreate;
    models.EntitlementBundle.findOrCreate = originals.bundleFindOrCreate;
    models.EntitlementGrant.findOrCreate = originals.grantFindOrCreate;
  }
});


test('entitlements de licencia sólo valen si pertenecen a la asignación y producto actuales', () => {
  const launchpadBundle = { id: 10, key: 'tool.launchpad', active: true, scope: 'channel' };
  const plusBundle = { id: 20, key: 'canvas.plus', active: true, scope: 'channel' };
  const licenseAssignment = {
    uuid: 'assign-launchpad',
    status: 'ACTIVE',
    license: {
      status: 'ACTIVE',
      startsAt: null,
      endsAt: null,
      product: {
        active: true,
        bundleLinks: [{ bundle: launchpadBundle }]
      }
    }
  };
  const channelAssignments = [
    { sourceType: 'license', sourceRef: 'assignment:assign-launchpad', bundleId: 10, bundle: launchpadBundle },
    { sourceType: 'license', sourceRef: 'assignment:assign-launchpad', bundleId: 20, bundle: plusBundle },
    { sourceType: 'admin', sourceRef: 'manual:1', bundleId: 20, bundle: plusBundle }
  ];

  const filtered = filterValidLicenseEntitlements(channelAssignments, [licenseAssignment]);
  assert.deepEqual(filtered.map((row) => row.bundleId), [10, 20]);
  assert.equal(filtered[0].sourceRef, 'assignment:assign-launchpad');
  assert.equal(filtered[1].sourceType, 'admin');
});
