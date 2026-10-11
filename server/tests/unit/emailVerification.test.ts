import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  generateVerificationToken,
  hashVerificationToken,
  isTokenExpired,
  cooldownRemainingSeconds,
  VERIFICATION_TTL_MS,
  RESEND_COOLDOWN_MS,
} from '../../src/lib/emailVerification.js';

test('token is 32 random bytes (64 hex chars); only its SHA-256 hash is stored', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const a = generateVerificationToken(now);
  const b = generateVerificationToken(now);
  assert.match(a.token, /^[0-9a-f]{64}$/);
  assert.notEqual(a.token, b.token);
  assert.equal(a.tokenHash, createHash('sha256').update(a.token).digest('hex'));
  assert.equal(a.tokenHash, hashVerificationToken(a.token));
  assert.notEqual(a.tokenHash, a.token);
});

test('token expires 24h after issue', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const { expiresAt } = generateVerificationToken(now);
  assert.equal(VERIFICATION_TTL_MS, 24 * 60 * 60 * 1000);
  assert.equal(expiresAt.getTime(), now.getTime() + VERIFICATION_TTL_MS);
  assert.equal(isTokenExpired(expiresAt, new Date(expiresAt.getTime() - 1)), false);
  assert.equal(isTokenExpired(expiresAt, expiresAt), true);
});

test('resend cooldown counts down from 60s after the last send', () => {
  const sentAt = new Date('2026-01-01T00:00:00Z');
  assert.equal(RESEND_COOLDOWN_MS, 60 * 1000);
  assert.equal(cooldownRemainingSeconds(null, sentAt), 0);
  assert.equal(cooldownRemainingSeconds(sentAt, new Date(sentAt.getTime() + 1_000)), 59);
  assert.equal(cooldownRemainingSeconds(sentAt, new Date(sentAt.getTime() + 59_500)), 1);
  assert.equal(cooldownRemainingSeconds(sentAt, new Date(sentAt.getTime() + 60_000)), 0);
});
