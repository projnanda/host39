import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { closeSql, getSql } from '../../src/db/client.js';
import { applyMigration, migrationFiles, resetDb } from '../helpers/db.js';

const NORMALISE = '004_normalise_email_domain.sql';

after(async () => { await closeSql(); });
beforeEach(async () => { await resetDb(NORMALISE); });

async function insertUser(email: string, handle: string, domain: string | null = null) {
  await getSql()`
    INSERT INTO users (email, handle, password_hash, identity_type, domain)
    VALUES (${email}, ${handle}, 'x', ${domain ? 'domain' : 'email'}, ${domain})
  `;
}

async function applyRest() {
  for (const file of migrationFiles().filter((f) => f >= NORMALISE)) await applyMigration(file);
}

test('lowercases existing emails and domains', async () => {
  await insertUser(' John@Hotmail.COM', 'john');
  await insertUser('admin@moonbakery.com', 'moon', 'MoonBakery.com');
  await applyRest();
  const rows = await getSql()`SELECT email, domain FROM users ORDER BY handle`;
  assert.deepEqual(rows.map((r) => [r.email, r.domain]), [
    ['john@hotmail.com', null],
    ['admin@moonbakery.com', 'moonbakery.com'],
  ]);
});

test('refuses to run when emails collide after lowercasing, reporting only a count', async () => {
  await insertUser('John@x.com', 'john1');
  await insertUser('john@x.com', 'john2');
  await assert.rejects(applyMigration(NORMALISE), (err: Error) => {
    assert.match(err.message, /1 email address\(es\)/);
    assert.doesNotMatch(err.message, /john@x\.com/i);
    return true;
  });
  // Nothing changed — the migration's transaction rolled back.
  const rows = await getSql()`SELECT email FROM users ORDER BY handle`;
  assert.deepEqual(rows.map((r) => r.email), ['John@x.com', 'john@x.com']);
});

test('refuses to run when domains collide after lowercasing', async () => {
  await insertUser('a@x.com', 'a1', 'Moon.com');
  await insertUser('b@x.com', 'a2', 'moon.com');
  await assert.rejects(applyMigration(NORMALISE), /1 domain\(s\)/);
});

test('existing users stay usable: email_verified and domain_verified are true; new rows default false', async () => {
  await insertUser('a@x.com', 'a1');
  await insertUser('b@moon.com', 'b1', 'moon.com');
  await applyRest();
  const existing = await getSql()`SELECT email_verified, domain_verified FROM users`;
  assert.ok(existing.every((r) => r.emailVerified === true && r.domainVerified === true));

  await insertUser('c@new.com', 'c1', 'new.com');
  const [fresh] = await getSql()`SELECT email_verified, domain_verified FROM users WHERE handle = 'c1'`;
  assert.equal(fresh!.emailVerified, false);
  assert.equal(fresh!.domainVerified, false);
});
