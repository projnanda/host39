import { createHash, randomBytes } from 'node:crypto';

/**
 * Email-verification tokens. The raw token only ever exists in the emailed
 * link; the DB stores its SHA-256 hash, so a DB leak can't verify accounts.
 */

const TOKEN_BYTES = 32;
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
/** Minimum gap between verification emails to one account (anti inbox-spam). */
export const RESEND_COOLDOWN_MS = 60 * 1000;
const MS_PER_SECOND = 1000;

export interface VerificationToken {
  readonly token: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateVerificationToken(now: Date = new Date()): VerificationToken {
  const token = randomBytes(TOKEN_BYTES).toString('hex');
  return {
    token,
    tokenHash: hashVerificationToken(token),
    expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
  };
}

export function isTokenExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** Whole seconds until another verification email may be sent (0 = now). */
export function cooldownRemainingSeconds(lastSentAt: Date | null, now: Date = new Date()): number {
  if (!lastSentAt) return 0;
  const remainingMs = lastSentAt.getTime() + RESEND_COOLDOWN_MS - now.getTime();
  return remainingMs > 0 ? Math.ceil(remainingMs / MS_PER_SECOND) : 0;
}
