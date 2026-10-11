import type { FastifyInstance } from 'fastify';
import { getSql } from '../db/client.js';
import { buildVerificationEmail, EmailDeliveryError, type EmailSender } from '../lib/email.js';
import {
  cooldownRemainingSeconds,
  generateVerificationToken,
  hashVerificationToken,
  RESEND_COOLDOWN_MS,
} from '../lib/emailVerification.js';

const TOKEN_RE = /^[0-9a-f]{64}$/;
const MAX_TOKEN_LENGTH = 128;

const apiErrorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    detail: { type: 'string' },
    retry_after_seconds: { type: 'integer' },
  },
} as const;

export type IssueResult =
  | { readonly kind: 'sent' }
  | { readonly kind: 'already_verified' }
  | { readonly kind: 'cooldown'; readonly retryAfterSeconds: number };

/** Issues a fresh token (invalidating any previous one) and emails the link. */
export type VerificationIssuer = (userId: string, options: { enforceCooldown: boolean }) => Promise<IssueResult>;

/**
 * Throws EmailDeliveryError if the provider fails. In that case the cooldown
 * is released so the user can retry straight away.
 */
export function createVerificationIssuer(sender: EmailSender, frontendUrl: string): VerificationIssuer {
  const sql = getSql();

  return async (userId, { enforceCooldown }) => {
    const { token, tokenHash, expiresAt } = generateVerificationToken();

    // Claim the send atomically so concurrent resends can't bypass the cooldown.
    const [claimed] = await sql<{ email: string }[]>`
      UPDATE users SET
        email_verification_token_hash = ${tokenHash},
        email_verification_expires_at = ${expiresAt},
        email_verification_sent_at    = NOW()
      WHERE id = ${userId}
        AND email_verified = FALSE
        AND (
          ${!enforceCooldown}
          OR email_verification_sent_at IS NULL
          OR email_verification_sent_at <= NOW() - ${RESEND_COOLDOWN_MS}::int * INTERVAL '1 millisecond'
        )
      RETURNING email
    `;

    if (!claimed) {
      const [user] = await sql<{ emailVerified: boolean; emailVerificationSentAt: Date | null }[]>`
        SELECT email_verified, email_verification_sent_at FROM users WHERE id = ${userId}
      `;
      if (!user || user.emailVerified) return { kind: 'already_verified' };
      return { kind: 'cooldown', retryAfterSeconds: Math.max(1, cooldownRemainingSeconds(user.emailVerificationSentAt)) };
    }

    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;
    try {
      await sender(buildVerificationEmail(claimed.email, verifyUrl));
    } catch (err) {
      await sql`
        UPDATE users SET email_verification_sent_at = NULL
        WHERE id = ${userId} AND email_verification_token_hash = ${tokenHash}
      `;
      throw err;
    }
    return { kind: 'sent' };
  };
}

/**
 *   POST /auth/verify-email         — { token } from the emailed link; single-use
 *   POST /auth/resend-verification  — (JWT) new link, at most once per cooldown
 *
 * Unverified users can log in, but their cards are not publicly served.
 */
export async function registerEmailVerificationRoutes(
  fastify: FastifyInstance,
  issueVerification: VerificationIssuer,
): Promise<void> {
  const sql = getSql();

  fastify.post<{ Body: { token: string } }>(
    '/auth/verify-email',
    {
      schema: {
        tags: ['auth'],
        summary: 'Verify your email with the token from the verification link',
        body: {
          type: 'object',
          required: ['token'],
          additionalProperties: false,
          properties: { token: { type: 'string', maxLength: MAX_TOKEN_LENGTH } },
        },
        response: {
          200: { type: 'object', properties: { email_verified: { type: 'boolean' } } },
          400: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const invalid = { error: 'INVALID_TOKEN', detail: 'this verification link is invalid or has already been used' };
      const { token } = request.body;
      if (!TOKEN_RE.test(token)) {
        return reply.code(400).send(invalid);
      }

      const tokenHash = hashVerificationToken(token);
      const [verified] = await sql<{ id: string }[]>`
        UPDATE users SET
          email_verified = TRUE,
          email_verification_token_hash = NULL,
          email_verification_expires_at = NULL,
          updated_at = NOW()
        WHERE email_verification_token_hash = ${tokenHash}
          AND email_verification_expires_at > NOW()
        RETURNING id
      `;
      if (verified) {
        return reply.send({ email_verified: true });
      }

      const [expired] = await sql<{ id: string }[]>`
        SELECT id FROM users WHERE email_verification_token_hash = ${tokenHash}
      `;
      if (expired) {
        return reply.code(400).send({
          error: 'TOKEN_EXPIRED',
          detail: 'this verification link has expired — sign in and request a new one',
        });
      }
      return reply.code(400).send(invalid);
    },
  );

  fastify.post(
    '/auth/resend-verification',
    {
      schema: {
        tags: ['auth'],
        summary: 'Email a new verification link',
        response: {
          200: {
            type: 'object',
            properties: { sent: { type: 'boolean' }, retry_after_seconds: { type: 'integer' } },
          },
          400: apiErrorSchema,
          401: apiErrorSchema,
          429: apiErrorSchema,
          502: apiErrorSchema,
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      let result: IssueResult;
      try {
        result = await issueVerification(request.user.userId, { enforceCooldown: true });
      } catch (err) {
        if (err instanceof EmailDeliveryError) {
          return reply.code(err.statusCode).send({
            error: 'EMAIL_DELIVERY_FAILED',
            detail: 'we could not send the verification email right now — please try again shortly',
          });
        }
        throw err;
      }

      if (result.kind === 'already_verified') {
        return reply.code(400).send({ error: 'ALREADY_VERIFIED', detail: 'your email is already verified' });
      }
      if (result.kind === 'cooldown') {
        reply.header('Retry-After', String(result.retryAfterSeconds));
        return reply.code(429).send({
          error: 'RESEND_COOLDOWN',
          detail: `please wait ${result.retryAfterSeconds}s before requesting another email`,
          retry_after_seconds: result.retryAfterSeconds,
        });
      }
      return reply.send({ sent: true, retry_after_seconds: Math.ceil(RESEND_COOLDOWN_MS / 1000) });
    },
  );
}
