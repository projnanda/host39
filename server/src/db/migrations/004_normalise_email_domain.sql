-- Emails and SMB domains are now stored and matched trimmed + lowercased
-- (same rule as the NANDA Index). Normalise existing rows.
--
-- Safety: if two existing rows would collapse onto the same value (e.g.
-- John@x.com and john@x.com), lowercasing would violate the UNIQUE constraint
-- and — worse — silently pick which account owns the identity. Instead we abort
-- the whole migration (it runs in one transaction, so nothing changes) with a
-- count only, so no addresses end up in logs. An operator must merge/rename
-- those accounts by hand, then re-run migrations.

DO $$
DECLARE
  email_dupes  INTEGER;
  domain_dupes INTEGER;
BEGIN
  SELECT COUNT(*) INTO email_dupes FROM (
    SELECT lower(trim(email)) FROM users GROUP BY 1 HAVING COUNT(*) > 1
  ) d;
  SELECT COUNT(*) INTO domain_dupes FROM (
    SELECT lower(trim(domain)) FROM users WHERE domain IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1
  ) d;

  IF email_dupes > 0 OR domain_dupes > 0 THEN
    RAISE EXCEPTION 'migration 004 aborted: % email address(es) and % domain(s) are shared by multiple users once lowercased. Resolve those accounts manually (see README "Upgrading"), then re-run migrations.',
      email_dupes, domain_dupes;
  END IF;
END $$;

UPDATE users SET email = lower(trim(email)) WHERE email <> lower(trim(email));
UPDATE users SET domain = lower(trim(domain)) WHERE domain IS NOT NULL AND domain <> lower(trim(domain));
