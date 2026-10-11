import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createResendSender,
  createLogSender,
  buildVerificationEmail,
  EmailDeliveryError,
  RESEND_API_URL,
} from '../../src/lib/email.js';

const API_KEY = 're_test_secret_key_123';
const FROM = 'Host39 <noreply@host39.org>';

interface Logged { level: string; obj: unknown; msg?: string }
function fakeLog() {
  const entries: Logged[] = [];
  const at = (level: string) => (obj: unknown, msg?: string) => { entries.push({ level, obj, msg }); };
  return { entries, log: { info: at('info'), warn: at('warn'), error: at('error') } };
}

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { calls, impl: impl as typeof fetch };
}

const EMAIL = buildVerificationEmail('john@hotmail.com', 'https://host39.org/verify-email?token=abc');

test('verification email carries the link in both text and html', () => {
  assert.equal(EMAIL.to, 'john@hotmail.com');
  assert.match(EMAIL.subject, /verify/i);
  assert.ok(EMAIL.text.includes('https://host39.org/verify-email?token=abc'));
  assert.ok(EMAIL.html.includes('href="https://host39.org/verify-email?token=abc"'));
  assert.match(EMAIL.text, /24 hours/);
});

test('Resend sender POSTs the documented request shape', async () => {
  const { calls, impl } = fakeFetch(200, { id: 'email_1' });
  const { log } = fakeLog();
  await createResendSender({ apiKey: API_KEY, from: FROM, log, fetchImpl: impl })(EMAIL);

  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call!.url, RESEND_API_URL);
  assert.equal(RESEND_API_URL, 'https://api.resend.com/emails');
  assert.equal(call!.init.method, 'POST');
  const headers = new Headers(call!.init.headers);
  assert.equal(headers.get('authorization'), `Bearer ${API_KEY}`);
  assert.equal(headers.get('content-type'), 'application/json');
  assert.deepEqual(JSON.parse(String(call!.init.body)), {
    from: FROM, to: EMAIL.to, subject: EMAIL.subject, html: EMAIL.html, text: EMAIL.text,
  });
});

test('Resend non-2xx throws EmailDeliveryError and logs status + message, never the key', async () => {
  const { impl } = fakeFetch(403, { statusCode: 403, name: 'validation_error', message: 'The host39.org domain is not verified.' });
  const { entries, log } = fakeLog();
  const send = createResendSender({ apiKey: API_KEY, from: FROM, log, fetchImpl: impl });

  await assert.rejects(send(EMAIL), (err: unknown) => {
    assert.ok(err instanceof EmailDeliveryError);
    assert.equal(err.statusCode, 502);
    return true;
  });
  const logged = JSON.stringify(entries);
  assert.match(logged, /403/);
  assert.match(logged, /domain is not verified/);
  assert.doesNotMatch(logged, new RegExp(API_KEY));
});

test('network failure also surfaces as EmailDeliveryError', async () => {
  const impl = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
  const { entries, log } = fakeLog();
  await assert.rejects(createResendSender({ apiKey: API_KEY, from: FROM, log, fetchImpl: impl })(EMAIL), EmailDeliveryError);
  assert.doesNotMatch(JSON.stringify(entries), new RegExp(API_KEY));
});

test('log sender logs the verification link instead of sending', async () => {
  const { entries, log } = fakeLog();
  await createLogSender(log)(EMAIL);
  assert.equal(entries.length, 1);
  assert.match(JSON.stringify(entries[0]), /verify-email\?token=abc/);
});
