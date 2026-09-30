import assert from 'node:assert/strict';
import { test } from 'node:test';
import { db, models } from '../models/index.js';
import { releaseLicenseAssignment } from '../services/storeLicenseService.js';
import { activeAssignmentsForLicense } from '../services/storeCatalogService.js';
import { StoreController } from '../controllers/store/storeController.js';

test('el servicio impide retirar licencias sin modificar asignaciones ni permisos', async (t) => {
  const transaction = t.mock.method(db, 'transaction', () => { throw new Error('No debe iniciar una mutación'); });
  const update = t.mock.method(models.LicenseAssignment, 'update', () => { throw new Error('No debe modificar asignaciones'); });
  await assert.rejects(releaseLicenseAssignment(1, 'license', 'assignment'), { status: 403, code: 'LICENSE_ASSIGNMENT_PERMANENT' });
  assert.equal(transaction.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
});

test('el endpoint antiguo de retiro también rechaza clientes antiguos o peticiones directas', async () => {
  await assert.rejects(StoreController.releaseLicense({ user: { id: 1 }, params: {} }, {}), { status: 403, code: 'LICENSE_ASSIGNMENT_PERMANENT' });
});

test('el cupo usado se cuenta por licencia aunque el lienzo haya sido eliminado', async (t) => {
  const transaction = {};
  t.mock.method(models.LicenseAssignment, 'count', async (options) => {
    assert.deepEqual(options.where, { licenseId: 7, status: 'ACTIVE' });
    assert.equal(options.transaction, transaction);
    // Las asignaciones cuyo channelId quedó en null también consumen el cupo.
    return 1;
  });
  assert.equal(await activeAssignmentsForLicense(7, transaction), 1);
});
