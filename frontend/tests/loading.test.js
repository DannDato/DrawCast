import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import { getLoadingSnapshot, startLoading, subscribeLoading, withLoading } from '../src/utils/loading.js';

test('mantiene la carga hasta finalizar todas las operaciones y tolera cierres repetidos', async () => {
  let notifications = 0;
  const unsubscribe = subscribeLoading(() => { notifications += 1; });
  const first = startLoading('Primera');
  const second = startLoading('Segunda');

  assert.deepEqual(getLoadingSnapshot(), { active: true, message: 'Segunda' });
  first();
  first();
  assert.equal(getLoadingSnapshot().active, true);
  second();
  assert.equal(getLoadingSnapshot().active, true);
  await wait(300);
  assert.equal(getLoadingSnapshot().active, false);
  assert.equal(notifications, 4);
  unsubscribe();
});

test('una operación nueva cancela el cierre pendiente', async () => {
  startLoading('Primera')();
  const finish = startLoading('Nueva');
  await wait(300);
  assert.deepEqual(getLoadingSnapshot(), { active: true, message: 'Nueva' });
  finish();
  await wait(300);
  assert.equal(getLoadingSnapshot().active, false);
});

test('withLoading conserva el resultado y libera la carga cuando falla la tarea', async () => {
  assert.equal(await withLoading(async () => 42), 42);
  await assert.rejects(withLoading(async () => { throw new Error('Fallo esperado'); }), /Fallo esperado/);
  await wait(300);
  assert.equal(getLoadingSnapshot().active, false);
});
