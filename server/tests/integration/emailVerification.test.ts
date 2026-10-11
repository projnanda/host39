import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { closeSql, getSql } from '../../src/db/client.js';
import { EmailDeliveryError, type OutgoingEmail } from '../../src/lib/email.js';
import { resetDb } from '../helpers/db.js';
import { buildTestServer, register, bearer } from '../helpers/server.js';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3002';

// Captured outbox; `failNext` simulates a provider outage.
const sent: OutgoingEmail[] = [];
let failNext = false;
const sender = async (email: OutgoingEmail) => {
  if (failNext) {
    failNext = false;
    throw new EmailDeliveryError('email provider returned 500');
  }
  sent.push(email);
};

let app: FastifyInstance;

before(async () => { app = await buildTestServer({ emailSender: sender }); });
after(async () => { await app.close(); await closeSql(); });
beforeEach(async () => {
  sent.length = 0;
  failNext = false;
  await resetDb();
});

function tokenFrom(email: OutgoingEmail): string {
  const match = email.text.match(/verify-email\?token=([0-9a-f]{64})/);
  assert.ok(match, `no verification link in: ${email.text}`);
  return match[1]!;
}

async function registerJohn() {
  const res = await register(app, { email: 'John@Hotmail.com', handle: 'john' });
  assert.equal(res.statusCode, 201);
  return res.json() as { token: string; verification_email_sent: boolean };
}

async function createCard(token: string) {
  const res = await app.inject({
    method: 'POST', url: '/cards', headers: bearer(token),
    payload: { slug: 'card', display_name: 'Card' },
  });
  assert.equal(res.statusCode, 201);
}

const verifyEmail = (token: string) =>
  app.inject({ method: 'POST', url: '/auth/verify-email', payload: { token } });
const resend = (jwt: string) =>
  app.inject({ method: 'POST', url: '/auth/resend-verification', headers: bearer(jwt) });

async function catalogIdentifiers(): Promise<string[]> {
  const res = await app.inject({ method: 'GET', url: '/.well-known/ai-catalog.json' });
  return res.json().entries.map((e: { identifier: string }) => e.identifier);
}

test('register sends exactly one email with a working link to the web verify page', async () => {
  const body = await registerJohn();
  assert.equal(body.verification_email_sent, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.to, 'john@hotmail.com');
  assert.ok(sent[0]!.text.includes(`${FRONTEND_URL}/verify-email?token=`));

  // Only the hash is stored, never the raw token.
  const token = tokenFrom(sent[0]!);
  const [row] = await getSql()`SELECT email_verification_token_hash FROM users`;
  assert.notEqual(row!.emailVerificationTokenHash, token);
  assert.match(row!.emailVerificationTokenHash, /^[0-9a-f]{64}$/);
});

test('unverified user can log in but their cards are 404 and absent from the catalog', async () => {
  const { token } = await registerJohn();
  await createCard(token);

  const login = await app.inject({
    method: 'POST', url: '/auth/login', payload: { email: 'john@hotmail.com', password: 'correct-horse-battery' },
  });
  assert.equal(login.statusCode, 200);

  assert.equal((await app.inject({ method: 'GET', url: '/personal/john/card.json' })).statusCode, 404);
  assert.deepEqual(await catalogIdentifiers(), []);
});

test('verifying flips email_verified and makes cards public', async () => {
  const { token: jwt } = await registerJohn();
  await createCard(jwt);

  const res = await verifyEmail(tokenFrom(sent[0]!));
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().email_verified, true);

  const me = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(jwt) });
  assert.equal(me.json().email_verified, true);
  assert.equal((await app.inject({ method: 'GET', url: '/personal/john/card.json' })).statusCode, 200);
  assert.deepEqual(await catalogIdentifiers(), ['urn:air:host39.org:personal:john@hotmail.com']);
});

test('tokens are single-use', async () => {
  await registerJohn();
  const token = tokenFrom(sent[0]!);
  assert.equal((await verifyEmail(token)).statusCode, 200);
  const again = await verifyEmail(token);
  assert.equal(again.statusCode, 400);
  assert.equal(again.json().error, 'INVALID_TOKEN');
});

test('expired tokens are rejected', async () => {
  await registerJohn();
  await getSql()`UPDATE users SET email_verification_expires_at = NOW() - INTERVAL '1 second'`;
  const res = await verifyEmail(tokenFrom(sent[0]!));
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, 'TOKEN_EXPIRED');
  const [row] = await getSql()`SELECT email_verified FROM users`;
  assert.equal(row!.emailVerified, false);
});

test('garbage tokens are rejected', async () => {
  await registerJohn();
  assert.equal((await verifyEmail('not-a-token')).statusCode, 400);
  assert.equal((await verifyEmail('a'.repeat(64))).json().error, 'INVALID_TOKEN');
});

test('resend is rate-limited by a server-side cooldown, then issues a fresh token', async () => {
  const { token: jwt } = await registerJohn();

  const tooSoon = await resend(jwt);
  assert.equal(tooSoon.statusCode, 429);
  assert.equal(tooSoon.json().error, 'RESEND_COOLDOWN');
  assert.ok(tooSoon.json().retry_after_seconds > 0);
  assert.equal(sent.length, 1);

  await getSql()`UPDATE users SET email_verification_sent_at = NOW() - INTERVAL '61 seconds'`;
  const ok = await resend(jwt);
  assert.equal(ok.statusCode, 200);
  assert.equal(sent.length, 2);

  // The first link no longer works; the new one does.
  assert.equal((await verifyEmail(tokenFrom(sent[0]!))).statusCode, 400);
  assert.equal((await verifyEmail(tokenFrom(sent[1]!))).statusCode, 200);
});

test('resend for an already-verified account is refused', async () => {
  const { token: jwt } = await registerJohn();
  await verifyEmail(tokenFrom(sent[0]!));
  const res = await resend(jwt);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, 'ALREADY_VERIFIED');
});

test('provider failure on resend surfaces as 502 and does not start the cooldown', async () => {
  const { token: jwt } = await registerJohn();
  await getSql()`UPDATE users SET email_verification_sent_at = NOW() - INTERVAL '61 seconds'`;

  failNext = true;
  const failed = await resend(jwt);
  assert.equal(failed.statusCode, 502);
  assert.equal(failed.json().error, 'EMAIL_DELIVERY_FAILED');

  const retry = await resend(jwt);
  assert.equal(retry.statusCode, 200);
});

test('provider failure on register still creates the account but reports the email was not sent', async () => {
  failNext = true;
  const body = await registerJohn();
  assert.equal(body.verification_email_sent, false);
  assert.ok(body.token);

  // No cooldown after a failed send — the user can resend immediately.
  assert.equal((await resend(body.token)).statusCode, 200);
});

test('resend requires auth', async () => {
  const res = await app.inject({ method: 'POST', url: '/auth/resend-verification' });
  assert.equal(res.statusCode, 401);
});
