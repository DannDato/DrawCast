import assert from 'node:assert/strict';
import test from 'node:test';
import { requireSuperAdminPermissions } from '../middlewares/auth.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('system admin guard requires an authenticated user', () => {
  const res = responseRecorder();
  let nextCalled = false;
  requireSuperAdminPermissions('admin.system.access')({}, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('system admin guard rejects non super admins even with permission', () => {
  const req = { user: { roleKey: 'ADMIN' }, permissions: ['admin.system.access'] };
  const res = responseRecorder();
  let nextCalled = false;
  requireSuperAdminPermissions('admin.system.access')(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('system admin guard rejects super admins without explicit permission', () => {
  const req = { user: { roleKey: 'SUPER_ADMIN' }, permissions: [] };
  const res = responseRecorder();
  let nextCalled = false;
  requireSuperAdminPermissions('admin.system.access')(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('system admin guard accepts super admins with every explicit permission', () => {
  const req = { user: { roleKey: 'SUPER_ADMIN' }, permissions: ['admin.system.access', 'admin.users.read'] };
  const res = responseRecorder();
  let nextCalled = false;
  requireSuperAdminPermissions('admin.system.access', 'admin.users.read')(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
});
