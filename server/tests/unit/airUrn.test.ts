import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailSegment, isFqdn, personalAirUrn } from '../../src/lib/airUrn.js';

test('emailSegment keeps URN-safe characters verbatim and lowercases', () => {
  assert.equal(emailSegment('  John@Hotmail.com '), 'john@hotmail.com');
});

test('emailSegment percent-encodes unsafe characters with uppercase hex', () => {
  assert.equal(emailSegment('a#b@x.com'), 'a%23b@x.com');
  assert.equal(emailSegment('a/b@x.com'), 'a%2Fb@x.com');
  assert.equal(emailSegment('a:b@x.com'), 'a%3Ab@x.com');
});

test('emailSegment encodes non-ASCII as UTF-8 bytes', () => {
  assert.equal(emailSegment('é@x.com'), '%C3%A9@x.com');
});

test('personalAirUrn anchors to host39.org personal namespace', () => {
  assert.equal(personalAirUrn('John@Hotmail.com'), 'urn:air:host39.org:personal:john@hotmail.com');
});

test('isFqdn accepts real FQDNs and rejects bare labels', () => {
  assert.equal(isFqdn('moonbakery.com'), true);
  assert.equal(isFqdn('MoonBakery.COM'), true);
  assert.equal(isFqdn('personal'), false);
  assert.equal(isFqdn('.well-known'), false);
  assert.equal(isFqdn('-bad.com'), false);
  assert.equal(isFqdn('a..com'), false);
});
