import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { closeSql, getSql } from '../../src/db/client.js';
import { resetDb } from '../helpers/db.js';
import { buildTestServer, registerToken, bearer, markEmailVerified } from '../helpers/server.js';

let app: FastifyInstance;

before(async () => { app = await buildTestServer(); });
after(async () => { await app.close(); await closeSql(); });
beforeEach(async () => { await resetDb(); });

async function createCard(token: string, slug: string) {
  const res = await app.inject({
    method: 'POST', url: '/cards', headers: bearer(token),
    payload: { slug, display_name: `Card ${slug}`, runtime_url: 'https://agent.example.com' },
  });
  assert.equal(res.statusCode, 201);
}

async function setupSmb(verified: boolean) {
  const token = await registerToken(app, {
    email: 'admin@moonbakery.com', handle: 'moon', identity_type: 'domain', domain: 'moonbakery.com',
  });
  await markEmailVerified('admin@moonbakery.com');
  await createCard(token, 'orders');
  if (verified) await getSql()`UPDATE users SET domain_verified = TRUE WHERE domain = 'moonbakery.com'`;
}

test('personal card _meta.identifier is the per-email urn:air identifier', async () => {
  const token = await registerToken(app, { email: 'A#b@X.com', handle: 'ab' });
  await markEmailVerified('a#b@x.com');
  await createCard(token, 'card');
  const res = await app.inject({ method: 'GET', url: '/personal/ab/card.json' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json()._meta.identifier, 'urn:air:host39.org:personal:a%23b@x.com');
});

test('verified SMB card is served with urn:air:<domain>:agent:<slug>', async () => {
  await setupSmb(true);
  const res = await app.inject({ method: 'GET', url: '/moonbakery.com/orders.json' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json()._meta.identifier, 'urn:air:moonbakery.com:agent:orders');
});

test('SMB card is NOT served while the domain is unverified', async () => {
  await setupSmb(false);
  const res = await app.inject({ method: 'GET', url: '/moonbakery.com/orders.json' });
  assert.equal(res.statusCode, 404);
});

test('catalog omits unverified-domain cards and uses urn:air identifiers', async () => {
  await setupSmb(false);
  const personalToken = await registerToken(app, { email: 'john@hotmail.com', handle: 'john' });
  await markEmailVerified('john@hotmail.com');
  await createCard(personalToken, 'card');

  const before = await app.inject({ method: 'GET', url: '/.well-known/ai-catalog.json' });
  assert.deepEqual(before.json().entries.map((e: { identifier: string }) => e.identifier), [
    'urn:air:host39.org:personal:john@hotmail.com',
  ]);

  await getSql()`UPDATE users SET domain_verified = TRUE WHERE domain = 'moonbakery.com'`;
  const after = await app.inject({ method: 'GET', url: '/.well-known/ai-catalog.json' });
  const ids = after.json().entries.map((e: { identifier: string }) => e.identifier).sort();
  assert.deepEqual(ids, ['urn:air:host39.org:personal:john@hotmail.com', 'urn:air:moonbakery.com:agent:orders']);
});

test('catalog entries carry paper-shaped publisher and extensions', async () => {
  await setupSmb(true);
  const res = await app.inject({ method: 'GET', url: '/.well-known/ai-catalog.json' });
  const [entry] = res.json().entries;
  assert.equal(entry.type, 'application/a2a-agent-card+json');
  assert.equal(entry.mediaType, 'application/a2a-agent-card+json');
  assert.deepEqual(entry.publisher, { identifier: 'moonbakery.com', displayName: 'moonbakery.com', identityType: 'dns' });
  assert.equal(entry.extensions['org.projectnanda'].agentCardHost, 'host39.org');
  assert.equal(entry.extensions['org.projectnanda']['runtime.url'], 'https://agent.example.com');
});
