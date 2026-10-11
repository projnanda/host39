import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { getSql } from '../db/client.js';
import {
  CHALLENGE_TTL_MS,
  challengeRecordName,
  challengeRecordValue,
  lookupDomainToken,
  type TxtResolver,
} from '../lib/domainVerification.js';

const CHALLENGE_TOKEN_BYTES = 32;
/** How many observed TXT values to echo back when verification fails. */
const MAX_FOUND_IN_ERROR = 5;
const UNIQUE_VIOLATION = '23505';

const apiErrorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    detail: { type: 'string' },
  },
} as const;

interface DomainUserRow {
  id: string;
  identityType: 'domain' | 'email';
  domain: string | null;
  domainVerified: boolean;
  domainChallenge: string | null;
  domainChallengeExpiresAt: Date | null;
}

/**
 * Domain-ownership proof for SMB users:
 *   POST /auth/domain-challenge — issue (or rotate) a DNS TXT challenge
 *   POST /auth/verify-domain    — check DNS; on success set domain_verified
 *
 * Until verified, cards under /<domain>/ are not publicly served.
 */
export async function registerDomainRoutes(fastify: FastifyInstance, txtResolver?: TxtResolver): Promise<void> {
  const sql = getSql();

  async function findDomainUser(userId: string): Promise<DomainUserRow | undefined> {
    const [user] = await sql<DomainUserRow[]>`
      SELECT id, identity_type, domain, domain_verified, domain_challenge, domain_challenge_expires_at
      FROM users WHERE id = ${userId}
    `;
    return user;
  }

  const noDomain = {
    error: 'NO_DOMAIN',
    detail: 'only domain-identity (SMB) accounts have a domain to verify',
  } as const;

  fastify.post(
    '/auth/domain-challenge',
    {
      schema: {
        tags: ['auth'],
        summary: 'Issue a DNS TXT challenge to prove ownership of your domain',
        response: {
          200: {
            type: 'object',
            properties: {
              domain:       { type: 'string' },
              record_name:  { type: 'string' },
              record_type:  { type: 'string' },
              record_value: { type: 'string' },
              expires_at:   { type: 'string' },
            },
          },
          400: apiErrorSchema,
          401: apiErrorSchema,
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      const user = await findDomainUser(request.user.userId);
      if (!user) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', detail: 'user not found' });
      }
      if (user.identityType !== 'domain' || !user.domain) {
        return reply.code(400).send(noDomain);
      }

      const token = randomBytes(CHALLENGE_TOKEN_BYTES).toString('hex');
      const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
      await sql`
        UPDATE users
        SET domain_challenge = ${token}, domain_challenge_expires_at = ${expiresAt}, updated_at = NOW()
        WHERE id = ${user.id}
      `;

      return reply.send({
        domain:       user.domain,
        record_name:  challengeRecordName(user.domain),
        record_type:  'TXT',
        record_value: challengeRecordValue(token),
        expires_at:   expiresAt.toISOString(),
      });
    },
  );

  fastify.post(
    '/auth/verify-domain',
    {
      schema: {
        tags: ['auth'],
        summary: 'Check the DNS TXT challenge and mark your domain verified',
        response: {
          200: {
            type: 'object',
            properties: {
              domain:          { type: 'string' },
              domain_verified: { type: 'boolean' },
            },
          },
          400: apiErrorSchema,
          401: apiErrorSchema,
          409: apiErrorSchema,
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      const user = await findDomainUser(request.user.userId);
      if (!user) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', detail: 'user not found' });
      }
      if (user.identityType !== 'domain' || !user.domain) {
        return reply.code(400).send(noDomain);
      }
      if (user.domainVerified) {
        return reply.send({ domain: user.domain, domain_verified: true });
      }
      if (!user.domainChallenge || !user.domainChallengeExpiresAt || user.domainChallengeExpiresAt <= new Date()) {
        return reply.code(400).send({
          error: 'NO_ACTIVE_CHALLENGE',
          detail: 'no active domain challenge — request one via POST /auth/domain-challenge first',
        });
      }

      const expectedValue = challengeRecordValue(user.domainChallenge);
      const { verified, found } = await lookupDomainToken(user.domain, expectedValue, txtResolver);
      if (!verified) {
        const seen = found.length
          ? ` Found instead: ${found.slice(0, MAX_FOUND_IN_ERROR).map((v) => `"${v}"`).join(', ')}.`
          : '';
        return reply.code(400).send({
          error: 'DOMAIN_NOT_VERIFIED',
          detail: `expected TXT "${expectedValue}" at ${challengeRecordName(user.domain)}, but it was not found. DNS changes can take time to propagate — try again shortly.${seen}`,
        });
      }

      try {
        await sql`
          UPDATE users
          SET domain_verified = TRUE, domain_challenge = NULL, domain_challenge_expires_at = NULL, updated_at = NOW()
          WHERE id = ${user.id}
        `;
      } catch (err) {
        // users_verified_domain_key: another account verified this domain first.
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
          return reply.code(409).send({ error: 'CONFLICT', detail: 'this domain is already verified by another account' });
        }
        throw err;
      }
      return reply.send({ domain: user.domain, domain_verified: true });
    },
  );
}
