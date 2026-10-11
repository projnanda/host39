import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { closeSql } from '../../src/db/client.js';
import { resetDb } from '../helpers/db.js';
import { buildTestServer, registerToken, bearer } from '../helpers/server.js';

let app: FastifyInstance;
let token: string;

before(async () => { app = await buildTestServer(); });
after(async () => { await app.close(); await closeSql(); });
beforeEach(async () => {
  await resetDb();
  token = await registerToken(app, { email: 'a@x.com', handle: 'aaa' });
});

const BAD_URLS = ['javascript:alert(1)', 'data:text/html,hi', 'http://x.com', 'ftp://x.com', 'x.com'];

for (const field of ['runtime_url', 'provider_url'] as const) {
  for (const bad of BAD_URLS) {
    test(`POST /cards rejects ${field}="${bad}"`, async () => {
      const res = await app.inject({
        method: 'POST', url: '/cards', headers: bearer(token),
        payload: { slug: 'card', display_name: 'Card', [field]: bad },
      });
      assert.equal(res.statusCode, 400);
    });
  }

  test(`PUT /cards/:id rejects non-https ${field}`, async () => {
    const created = await app.inject({
      method: 'POST', url: '/cards', headers: bearer(token),
      payload: { slug: 'card', display_name: 'Card' },
    });
    const res = await app.inject({
      method: 'PUT', url: `/cards/${created.json().id}`, headers: bearer(token),
      payload: { [field]: 'javascript:alert(1)' },
    });
    assert.equal(res.statusCode, 400);
  });
}

test('POST /cards accepts https URLs', async () => {
  const res = await app.inject({
    method: 'POST', url: '/cards', headers: bearer(token),
    payload: { slug: 'card', display_name: 'Card', runtime_url: 'https://agent.x.com/a2a', provider_url: 'https://x.com' },
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().runtime_url, 'https://agent.x.com/a2a');
});
