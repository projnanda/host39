import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';
import { getSql } from '../../src/db/client.js';
import type { TxtResolver } from '../../src/lib/domainVerification.js';
import type { EmailSender, OutgoingEmail } from '../../src/lib/email.js';

export interface TestServerOptions {
  readonly txtResolver?: TxtResolver;
  readonly emailSender?: EmailSender;
}

/** Captures outgoing email instead of sending it. */
export function captureEmails(): { sent: OutgoingEmail[]; sender: EmailSender } {
  const sent: OutgoingEmail[] = [];
  return { sent, sender: async (email) => { sent.push(email); } };
}

export async function buildTestServer(options: TestServerOptions = {}): Promise<FastifyInstance> {
  const { fastify } = await buildServer({
    logger: false,
    txtResolver: options.txtResolver,
    emailSender: options.emailSender ?? captureEmails().sender,
  });
  await fastify.ready();
  return fastify;
}

export interface RegisterInput {
  email: string;
  handle: string;
  identity_type?: 'domain' | 'email';
  domain?: string;
}

export async function register(app: FastifyInstance, input: RegisterInput) {
  return app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { password: 'correct-horse-battery', ...input },
  });
}

export async function registerToken(app: FastifyInstance, input: RegisterInput): Promise<string> {
  const res = await register(app, input);
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  return (res.json() as { token: string }).token;
}

/** Shortcut past the email round-trip for tests that aren't about verification. */
export async function markEmailVerified(email: string): Promise<void> {
  await getSql()`UPDATE users SET email_verified = TRUE WHERE email = ${email.toLowerCase()}`;
}

export function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}
