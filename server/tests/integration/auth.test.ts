import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { closeSql, getSql } from '../../src/db/client.js';
import { resetDb } from '../helpers/db.js';
import { buildTestServer, register, registerToken, bearer } from '../helpers/server.js';

let app: FastifyInstance;

before(async () => { app = await buildTestServer(); });
after(async () => { await app.close(); await closeSql(); });
beforeEach(async () => { await resetDb(); });

test('register stores the email lowercased and login matches case-insensitively', async () => {
  const token = await registerToken(app, { email: 'John@Hotmail.COM', handle: 'john' });
  const me = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(token) });
  assert.equal(me.json().email, 'john@hotmail.com');

  const login = await app.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'JOHN@hotmail.com', password: 'correct-horse-battery' },
  });
  assert.equal(login.statusCode, 200);
});

test('register rejects an email that differs only by case', async () => {
  await registerToken(app, { email: 'john@hotmail.com', handle: 'john' });
  const res = await register(app, { email: 'John@Hotmail.com', handle: 'john2' });
  assert.equal(res.statusCode, 409);
});

test('register lowercases and stores a valid SMB domain', async () => {
  const token = await registerToken(app, {
    email: 'admin@moonbakery.com', handle: 'moon', identity_type: 'domain', domain: 'MoonBakery.com',
  });
  const me = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(token) });
  assert.equal(me.json().domain, 'moonbakery.com');
  assert.equal(me.json().domain_verified, false);
});

test('register rejects a verified domain, even when it differs only by case', async () => {
  await registerToken(app, { email: 'a@moonbakery.com', handle: 'moon', identity_type: 'domain', domain: 'moonbakery.com' });
  await getSql()`UPDATE users SET domain_verified = TRUE`;
  const res = await register(app, { email: 'b@x.com', handle: 'moon2', identity_type: 'domain', domain: 'MOONBAKERY.com' });
  assert.equal(res.statusCode, 409);
});

test('an unverified domain claim does not block another registrant (anti-squatting)', async () => {
  await registerToken(app, { email: 'squatter@x.com', handle: 'squat', identity_type: 'domain', domain: 'moonbakery.com' });
  const res = await register(app, { email: 'owner@moonbakery.com', handle: 'moon', identity_type: 'domain', domain: 'moonbakery.com' });
  assert.equal(res.statusCode, 201);
});

for (const domain of ['host39.org', 'agentcards.host39.org', 'personal', '.well-known', 'api', '_next', 'not a domain', 'https://x.com']) {
  test(`register rejects reserved/invalid domain "${domain}"`, async () => {
    const res = await register(app, { email: 'a@x.com', handle: 'aaa', identity_type: 'domain', domain });
    assert.equal(res.statusCode, 400);
  });
}

test('personal registration ignores a stray domain field (does not claim the domain)', async () => {
  const token = await registerToken(app, { email: 'a@x.com', handle: 'aaa', identity_type: 'email', domain: 'moonbakery.com' });
  const me = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(token) });
  assert.equal(me.json().domain, null);
});

test('/auth/me exposes email_verified (false for new accounts)', async () => {
  const token = await registerToken(app, { email: 'a@x.com', handle: 'aaa' });
  const me = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(token) });
  assert.equal(me.json().email_verified, false);
});
