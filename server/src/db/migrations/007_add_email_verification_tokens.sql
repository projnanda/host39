-- Email verification tokens (see lib/emailVerification.ts).
-- Only the SHA-256 hash of the emailed token is stored; it is single-use
-- (cleared on verify) and expires after 24h. email_verification_sent_at
-- enforces the resend cooldown server-side.
--
-- Does not touch email_verified: accounts grandfathered by migration 005 stay
-- verified. Only accounts created after deploy must click a link.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_hash CHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at    TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_verification_token_hash_key
  ON users (email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;
