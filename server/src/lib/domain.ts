import { isFqdn, PERSONAL_CARD_HOST_DOMAIN } from './airUrn.js';

/**
 * Path segments host39 (server routes, Next.js app, Caddy handles) owns at the
 * top level. An SMB domain becomes the first path segment of /<domain>/<slug>.json,
 * so it must never shadow one of these. Most can't pass the FQDN check anyway;
 * they're listed explicitly so the rejection message is clear and so the list
 * stays correct if the FQDN rule is ever relaxed.
 */
const RESERVED_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  'personal', '.well-known', 'api', '_next', 'auth', 'cards', 'health', 'docs', 'dashboard', 'login',
]);

export type DomainValidation =
  | { readonly ok: true; readonly domain: string }
  | { readonly ok: false; readonly detail: string };

export function normaliseDomain(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Validates an SMB domain: lowercase FQDN, not host39's own, not a reserved route. */
export function validateSmbDomain(raw: string): DomainValidation {
  const domain = normaliseDomain(raw);

  if (RESERVED_PATH_SEGMENTS.has(domain)) {
    return { ok: false, detail: `"${domain}" is reserved and cannot be used as a domain` };
  }
  if (!isFqdn(domain)) {
    return { ok: false, detail: `"${domain}" is not a valid domain name (expected e.g. moonbakery.com)` };
  }
  if (domain === PERSONAL_CARD_HOST_DOMAIN || domain.endsWith(`.${PERSONAL_CARD_HOST_DOMAIN}`)) {
    return { ok: false, detail: `${PERSONAL_CARD_HOST_DOMAIN} and its subdomains are reserved` };
  }
  return { ok: true, domain };
}
