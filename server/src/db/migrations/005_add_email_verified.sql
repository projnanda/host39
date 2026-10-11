-- Email verification flag.
--
-- New accounts must click an emailed link (migration 007 + routes/emailVerification.ts)
-- before their cards are publicly served.
--
-- Existing accounts are grandfathered as verified (column added with DEFAULT
-- TRUE, which back-fills every existing row) so production keeps working;
-- the default is then flipped so new accounts start unverified.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT FALSE;
