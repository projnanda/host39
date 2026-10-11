import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHttpsUrl } from '../../src/lib/httpsUrl.js';

test('accepts https URLs', () => {
  assert.equal(isHttpsUrl('https://moonbakery.com'), true);
  assert.equal(isHttpsUrl('HTTPS://moonbakery.com/a2a?x=1'), true);
});

test('rejects other schemes and junk', () => {
  for (const bad of [
    'http://moonbakery.com',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://x.com',
    '//moonbakery.com',
    'moonbakery.com',
    'https://',
    ' https://x.com',
    '',
  ]) {
    assert.equal(isHttpsUrl(bad), false, bad);
  }
});
