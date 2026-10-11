import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { closeSql } from '../../src/db/client.js';
import { resetDb } from '../helpers/db.js';
import { buildTestServer, registerToken, bearer, markEmailVerified } from '../helpers/server.js';

// Fake DNS: whatever TXT values a test publishes for a record name.
const published = new Map<string, string[][]>();
const fakeResolver = async (name: string): Promise<string[][]> => {
  const records = published.get(name);
  if (!records) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
  return records;
};

let app: FastifyInstance;
let smbToken: string;

before(async () => { app = await buildTestServer({ txtResolver: fakeResolver }); });
after(async () => { await app.close(); await closeSql(); });
beforeEach(async () => {
  published.clear();
  await resetDb();
  smbToken = await registerToken(app, {
    email: 'admin@moonbakery.com', handle: 'moon', identity_type: 'domain', domain: 'moonbakery.com',
  });
  await markEmailVerified('admin@moonbakery.com');
  await app.inject({
    method: 'POST', url: '/cards', headers: bearer(smbToken),
    payload: { slug: 'orders', display_name: 'Orders' },
  });
});

async function requestChallenge(token: string) {
  return app.inject({ method: 'POST', url: '/auth/domain-challenge', headers: bearer(token) });
}

async function verify(token: string) {
  return app.inject({ method: 'POST', url: '/auth/verify-domain', headers: bearer(token) });
}

test('challenge returns the TXT record to publish', async () => {
  const res = await requestChallenge(smbToken);
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.domain, 'moonbakery.com');
  assert.equal(body.record_name, '_host39-challenge.moonbakery.com');
  assert.equal(body.record_type, 'TXT');
  assert.match(body.record_value, /^host39-verify=[0-9a-f]{64}$/);
  assert.ok(Date.parse(body.expires_at) > Date.now());
});

test('verify fails without a challenge', async () => {
  const res = await verify(smbToken);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, 'NO_ACTIVE_CHALLENGE');
});

test('verify fails when the TXT record is missing or wrong', async () => {
  await requestChallenge(smbToken);
  assert.equal((await verify(smbToken)).json().error, 'DOMAIN_NOT_VERIFIED');
  published.set('_host39-challenge.moonbakery.com', [['host39-verify=wrong']]);
  assert.equal((await verify(smbToken)).statusCode, 400);
  const card = await app.inject({ method: 'GET', url: '/moonbakery.com/orders.json' });
  assert.equal(card.statusCode, 404);
});

test('verify succeeds with the right TXT record and the card becomes public', async () => {
  const challenge = (await requestChallenge(smbToken)).json();
  // TXT records can be split into chunks — they must be joined before matching.
  const value: string = challenge.record_value;
  published.set(challenge.record_name, [['unrelated'], [value.slice(0, 10), value.slice(10)]]);

  const res = await verify(smbToken);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().domain_verified, true);

  const me = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(smbToken) });
  assert.equal(me.json().domain_verified, true);
  const card = await app.inject({ method: 'GET', url: '/moonbakery.com/orders.json' });
  assert.equal(card.statusCode, 200);
});

test('squatter cannot verify; the real owner can, and only their card is served', async () => {
  const squatterToken = await registerToken(app, {
    email: 'squatter@evil.com', handle: 'squat', identity_type: 'domain', domain: 'moonbakery.com',
  });
  await app.inject({
    method: 'POST', url: '/cards', headers: bearer(squatterToken),
    payload: { slug: 'orders', display_name: 'Evil Orders' },
  });
  await requestChallenge(squatterToken);
  assert.equal((await verify(squatterToken)).statusCode, 400);

  const owner = (await requestChallenge(smbToken)).json();
  published.set(owner.record_name, [[owner.record_value]]);
  assert.equal((await verify(smbToken)).statusCode, 200);

  const card = await app.inject({ method: 'GET', url: '/moonbakery.com/orders.json' });
  assert.equal(card.json().name, 'Orders');
});

test('a second account cannot verify a domain someone else already verified', async () => {
  const owner = (await requestChallenge(smbToken)).json();
  published.set(owner.record_name, [[owner.record_value]]);
  assert.equal((await verify(smbToken)).statusCode, 200);

  // A later registrant is refused at sign-up because the domain is now verified.
  const res = await app.inject({
    method: 'POST', url: '/auth/register',
    payload: { email: 'x@y.com', handle: 'late', password: 'correct-horse-battery', identity_type: 'domain', domain: 'moonbakery.com' },
  });
  assert.equal(res.statusCode, 409);
});

test('personal users cannot request a domain challenge', async () => {
  const token = await registerToken(app, { email: 'a@x.com', handle: 'aaa' });
  const res = await requestChallenge(token);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, 'NO_DOMAIN');
});

test('challenge endpoints require auth', async () => {
  const res = await app.inject({ method: 'POST', url: '/auth/domain-challenge' });
  assert.equal(res.statusCode, 401);
});
