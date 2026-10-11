import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSmbDomain } from '../../src/lib/domain.js';

test('accepts and lowercases a valid FQDN', () => {
  assert.deepEqual(validateSmbDomain('  MoonBakery.com '), { ok: true, domain: 'moonbakery.com' });
});

test('rejects values that are not FQDNs', () => {
  for (const bad of ['moonbakery', 'moon bakery.com', 'https://moonbakery.com', 'moonbakery.com/x', '-x.com', '']) {
    assert.equal(validateSmbDomain(bad).ok, false, bad);
  }
});

test('rejects host39.org and its subdomains', () => {
  for (const bad of ['host39.org', 'HOST39.ORG', 'agentcards.host39.org', 'a.b.host39.org']) {
    assert.equal(validateSmbDomain(bad).ok, false, bad);
  }
});

test('does not treat lookalike domains as host39 subdomains', () => {
  assert.deepEqual(validateSmbDomain('nothost39.org'), { ok: true, domain: 'nothost39.org' });
});

test('rejects names that collide with host39 routes', () => {
  for (const bad of ['personal', '.well-known', 'api', '_next', 'auth', 'cards', 'health', 'docs', 'dashboard', 'login']) {
    const result = validateSmbDomain(bad);
    assert.equal(result.ok, false, bad);
  }
});
