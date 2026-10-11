-- DNS TXT domain-ownership proof for SMB (domain-identity) users.
-- Cards under /<domain>/ are only served once domain_verified = TRUE.
--
-- Existing accounts are grandfathered as verified (column added with DEFAULT
-- TRUE back-fills every existing row) so already-published SMB cards keep
-- resolving; the default is then flipped so new domains must prove ownership.

ALTER TABLE users ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN domain_verified SET DEFAULT FALSE;

-- Pending challenge token (hex) and its expiry. Cleared on successful verification.
ALTER TABLE users ADD COLUMN IF NOT EXISTS domain_challenge VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS domain_challenge_expires_at TIMESTAMPTZ;

-- Anti-squatting: an unverified claim must not block the real owner. A domain
-- is only exclusive once verified, so drop the plain UNIQUE (from 001) and
-- enforce uniqueness among verified holders only. Grandfathered rows are all
-- verified and were already unique, so this index builds cleanly.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_domain_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_verified_domain_key ON users (domain) WHERE domain_verified;
