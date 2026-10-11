import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { getSql } from '../db/client.js';
import { buildConfig } from '../config.js';
import { EmailDeliveryError, normaliseEmail } from '../lib/email.js';
import type { VerificationIssuer } from './emailVerification.js';
import { validateSmbDomain } from '../lib/domain.js';
import type { DbUser } from '../types.js';

const BCRYPT_ROUNDS = 12;

const jwtResponseSchema = {
  type: 'object',
  required: ['token'],
  properties: {
    token: { type: 'string' },
  },
} as const;

const apiErrorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    detail: { type: 'string' },
  },
} as const;

interface RegisterBody {
  email: string;
  password: string;
  handle: string;
  display_name?: string;
  identity_type?: 'domain' | 'email';
  domain?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

export async function registerAuthRoutes(
  fastify: FastifyInstance,
  issueVerification: VerificationIssuer,
): Promise<void> {
  const config = buildConfig();
  const sql = getSql();

  /** A provider outage must not lose the account — report it and let the user resend. */
  async function sendInitialVerification(userId: string): Promise<boolean> {
    try {
      const result = await issueVerification(userId, { enforceCooldown: false });
      return result.kind === 'sent';
    } catch (err) {
      if (err instanceof EmailDeliveryError) {
        fastify.log.warn({ userId }, 'verification email not sent on register');
        return false;
      }
      throw err;
    }
  }

  // POST /auth/register
  fastify.post<{ Body: RegisterBody }>(
    '/auth/register',
    {
      schema: {
        tags: ['auth'],
        summary: 'Register a new account',
        body: {
          type: 'object',
          required: ['email', 'password', 'handle'],
          additionalProperties: false,
          properties: {
            email:         { type: 'string', format: 'email', maxLength: 255 },
            password:      { type: 'string', minLength: 8, maxLength: 128 },
            handle:        { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{1,31}$', maxLength: 32 },
            display_name:  { type: 'string', maxLength: 255 },
            identity_type: { type: 'string', enum: ['domain', 'email'] },
            domain:        { type: 'string', maxLength: 255 },
          },
        },
        response: {
          201: {
            type: 'object',
            required: ['token', 'verification_email_sent'],
            properties: {
              token: { type: 'string' },
              verification_email_sent: { type: 'boolean' },
            },
          },
          409: apiErrorSchema,
          400: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { password, handle, display_name, identity_type = 'email' } = request.body;
      const email = normaliseEmail(request.body.email);

      // Domain identity requires a valid, non-reserved domain. A domain sent with
      // an email identity is ignored so personal accounts can't claim one.
      let domain: string | null = null;
      if (identity_type === 'domain') {
        if (!request.body.domain) {
          return reply.code(400).send({ error: 'BAD_REQUEST', detail: 'domain is required for domain identity type' });
        }
        const validation = validateSmbDomain(request.body.domain);
        if (!validation.ok) {
          return reply.code(400).send({ error: 'BAD_REQUEST', detail: validation.detail });
        }
        domain = validation.domain;
      }

      // Check email uniqueness
      const [existing] = await sql<DbUser[]>`
        SELECT id FROM users WHERE email = ${email}
      `;
      if (existing) {
        return reply.code(409).send({ error: 'CONFLICT', detail: 'email already registered' });
      }

      // Check handle uniqueness
      const [existingHandle] = await sql<DbUser[]>`
        SELECT id FROM users WHERE handle = ${handle}
      `;
      if (existingHandle) {
        return reply.code(409).send({ error: 'CONFLICT', detail: 'handle already taken' });
      }

      // A domain is only exclusive once someone has proven ownership (DNS TXT);
      // unverified claims must not let a squatter block the real owner.
      if (domain) {
        const [existingDomain] = await sql<DbUser[]>`
          SELECT id FROM users WHERE domain = ${domain} AND domain_verified = TRUE
        `;
        if (existingDomain) {
          return reply.code(409).send({ error: 'CONFLICT', detail: 'domain already registered' });
        }
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const [user] = await sql<DbUser[]>`
        INSERT INTO users (email, handle, display_name, password_hash, identity_type, domain)
        VALUES (
          ${email},
          ${handle},
          ${display_name ?? null},
          ${passwordHash},
          ${identity_type},
          ${domain}
        )
        RETURNING id, email, handle, display_name, identity_type, domain
      `;

      if (!user) {
        return reply.code(500).send({ error: 'internal_server_error' });
      }

      // The account works immediately (so the user can resend), but its cards
      // aren't publicly served until the emailed link is clicked.
      const verificationEmailSent = await sendInitialVerification(user.id);

      const token = await reply.jwtSign(
        { userId: user.id, email: user.email },
        { expiresIn: config.jwt.expiresIn },
      );

      return reply.code(201).send({ token, verification_email_sent: verificationEmailSent });
    },
  );

  // POST /auth/login
  fastify.post<{ Body: LoginBody }>(
    '/auth/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign in with email and password',
        body: {
          type: 'object',
          required: ['email', 'password'],
          additionalProperties: false,
          properties: {
            email:    { type: 'string', format: 'email', maxLength: 255 },
            password: { type: 'string', minLength: 1, maxLength: 128 },
          },
        },
        response: {
          200: jwtResponseSchema,
          401: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { password } = request.body;
      const email = normaliseEmail(request.body.email);

      const [user] = await sql<DbUser[]>`
        SELECT id, email, display_name, password_hash, identity_type, domain
        FROM users WHERE email = ${email}
      `;

      if (!user || !user.passwordHash) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', detail: 'invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', detail: 'invalid email or password' });
      }

      const token = await reply.jwtSign(
        { userId: user.id, email: user.email },
        { expiresIn: config.jwt.expiresIn },
      );

      return reply.code(200).send({ token });
    },
  );

  // GET /auth/me
  fastify.get(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'Get current user profile',
        response: {
          200: {
            type: 'object',
            properties: {
              user_id:       { type: 'string' },
              email:         { type: 'string' },
              handle:        { type: 'string' },
              display_name:  { type: 'string', nullable: true },
              identity_type: { type: 'string' },
              domain:        { type: 'string', nullable: true },
              email_verified:  { type: 'boolean' },
              domain_verified: { type: 'boolean' },
            },
          },
          401: apiErrorSchema,
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      const { userId } = request.user;

      const [user] = await sql<DbUser[]>`
        SELECT id, email, handle, display_name, identity_type, domain, email_verified, domain_verified
        FROM users WHERE id = ${userId}
      `;

      if (!user) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', detail: 'user not found' });
      }

      return reply.send({
        user_id:       user.id,
        email:         user.email,
        handle:        user.handle,
        display_name:  user.displayName,
        identity_type: user.identityType,
        domain:        user.domain,
        email_verified:  user.emailVerified,
        // Only meaningful for domain-identity users.
        domain_verified: user.identityType === 'domain' && user.domainVerified,
      });
    },
  );
}
