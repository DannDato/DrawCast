import assert from 'node:assert/strict';
import test from 'node:test';
import { WELCOME_PLUS_DAYS, welcomePlusEndsAt } from '../services/welcomeLicenseService.js';

test('welcome Plus license lasts exactly 14 days', () => {
  const startsAt = new Date('2026-10-01T12:00:00.000Z');
  const endsAt = welcomePlusEndsAt(startsAt);
  assert.equal(WELCOME_PLUS_DAYS, 14);
  assert.equal(endsAt.toISOString(), '2026-10-15T12:00:00.000Z');
});

test('welcome Plus expiration does not mutate the start date', () => {
  const startsAt = new Date('2026-10-01T12:00:00.000Z');
  const before = startsAt.getTime();
  welcomePlusEndsAt(startsAt);
  assert.equal(startsAt.getTime(), before);
});
