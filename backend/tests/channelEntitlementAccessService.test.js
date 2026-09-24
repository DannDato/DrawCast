import test from 'node:test';
import assert from 'node:assert/strict';
import {
  entitlementError,
  featureForObject,
  getLimit,
  hasFeature,
  limitError,
  publicOverlayBranding,
  requireDrawModeFeature,
  requireFeatureValue,
  requireObjectFeature
} from '../services/channelEntitlementAccessService.js';

const entitlements = {
  features: {
    'editor.brush': true,
    'editor.eraser': false,
    'editor.text': false,
    'editor.timer': true,
    'editor.image': true,
    'editor.line': false,
    'overlay.remove_watermark': false,
    'editor.shape': true
  },
  limits: { 'limit.layers': 5 }
};

test('featureForObject mapea objetos del editor a capabilities', () => {
  assert.equal(featureForObject({ tipo: 'text' }), 'editor.text');
  assert.equal(featureForObject({ tipo: 'timer' }), 'editor.timer');
  assert.equal(featureForObject({ tipo: 'image' }), 'editor.image');
  assert.equal(featureForObject({ tipo: 'shape', shapeType: 'line' }), 'editor.line');
  assert.equal(featureForObject({ tipo: 'shape', shapeType: 'rect' }), 'editor.shape');
  assert.equal(featureForObject({ tipo: 'draw' }), null);
});

test('guards bloquean features aunque el cliente intente saltarse el frontend', () => {
  assert.doesNotThrow(() => requireFeatureValue(entitlements, 'editor.brush'));
  assert.throws(() => requireFeatureValue(entitlements, 'editor.text'), (error) => error.code === 'FEATURE_LOCKED' && error.feature === 'editor.text' && error.status === 403);
  assert.throws(() => requireObjectFeature(entitlements, { tipo: 'shape', shapeType: 'line' }), (error) => error.feature === 'editor.line');
  assert.doesNotThrow(() => requireObjectFeature(entitlements, { tipo: 'draw', lineas: [{ mode: 'paint' }] }));
  assert.throws(() => requireObjectFeature(entitlements, { tipo: 'draw', lineas: [{ mode: 'erase' }] }), (error) => error.feature === 'editor.eraser');
  assert.throws(() => requireDrawModeFeature(entitlements, 'erase'), (error) => error.feature === 'editor.eraser');
  assert.doesNotThrow(() => requireDrawModeFeature(entitlements, 'paint'));
});

test('helpers de límites conservan metadata segura para HTTP/socket', () => {
  assert.equal(hasFeature(entitlements, 'editor.brush'), true);
  assert.equal(hasFeature(entitlements, 'editor.text'), false);
  assert.equal(getLimit(entitlements, 'limit.layers'), 5);
  assert.equal(getLimit(entitlements, 'limit.missing'), 0);

  const feature = entitlementError('editor.text');
  assert.equal(feature.code, 'FEATURE_LOCKED');
  assert.equal(feature.status, 403);

  const limit = limitError('limit.layers', 5);
  assert.equal(limit.code, 'ENTITLEMENT_LIMIT_REACHED');
  assert.equal(limit.status, 409);
  assert.equal(limit.limitKey, 'limit.layers');
  assert.equal(limit.limit, 5);
});


test('branding público sólo expone si el overlay requiere marca de agua', () => {
  assert.deepEqual(publicOverlayBranding(entitlements), { watermark: true });
  assert.deepEqual(publicOverlayBranding({ features: { 'overlay.remove_watermark': true } }), { watermark: false });
});
