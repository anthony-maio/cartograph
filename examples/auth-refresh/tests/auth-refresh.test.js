import test from 'node:test';
import assert from 'node:assert/strict';
import { canRefreshSession } from '../src/auth/refresh.js';

const expirySeconds = 1800000000;
const session = { refreshExpiresAt: expirySeconds, revoked: false };

test('refresh token remains valid before expiry with a millisecond clock', () => {
  assert.equal(canRefreshSession(session, expirySeconds * 1000 - 1), true);
});

test('refresh token is rejected at the exact expiry boundary', () => {
  assert.equal(canRefreshSession(session, expirySeconds * 1000), false);
});

test('revoked sessions cannot refresh even before token expiry', () => {
  assert.equal(canRefreshSession({ ...session, revoked: true }, expirySeconds * 1000 - 1000), false);
});
