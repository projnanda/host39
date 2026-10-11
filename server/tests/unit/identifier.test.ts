import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIdentifier, buildPublicUrl } from '../../src/lib/identifier.js';
import type { DbUser } from '../../src/types.js';

function user(overrides: Partial<DbUser>): DbUser {
  return {
    id: 'u1',
    email: 'john@hotmail.com',
    handle: 'john',
    displayName: null,
    passwordHash: '',
    identityType: 'email',
    domain: null,
    emailVerified: true,
    domainVerified: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

test('SMB identifier is urn:air:<domain>:agent:<slug>', () => {
  const smb = user({ identityType: 'domain', domain: 'moonbakery.com', email: 'admin@moonbakery.com' });
  assert.equal(buildIdentifier(smb, 'orders'), 'urn:air:moonbakery.com:agent:orders');
});

test('personal identifier is the per-email host39.org identifier, independent of slug', () => {
  const personal = user({ email: 'A#b@X.com' });
  assert.equal(buildIdentifier(personal, 'card'), 'urn:air:host39.org:personal:a%23b@x.com');
  assert.equal(buildIdentifier(personal, 'other'), 'urn:air:host39.org:personal:a%23b@x.com');
});

test('personal public URL uses the handle', () => {
  assert.equal(
    buildPublicUrl(user({}), 'card', 'https://agentcards.host39.org'),
    'https://agentcards.host39.org/personal/john/card.json',
  );
});
