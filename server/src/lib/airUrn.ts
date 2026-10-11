/**
 * ARD domain-anchored resource identifiers (AIR URNs), as used by the NANDA Index:
 *
 *   urn:air:<publisher-FQDN>:<namespace...>:<short-name>
 *
 * SMB agents:     urn:air:<their-domain>:agent:<slug>
 * Personal users: urn:air:host39.org:personal:<emailSegment(email)>
 *
 * FQDN_RE, SEGMENT_LITERAL_RE and emailSegment() are copied verbatim from
 * nanda-index-v2/server/src/lib/airUrn.ts so both sides produce byte-identical
 * identifiers. Keep them in sync if the index changes its encoding.
 */

/** The card host that anchors identifiers for domain-less individuals. */
export const PERSONAL_CARD_HOST_DOMAIN = 'host39.org';
export const PERSONAL_NAMESPACE = 'personal';
export const AGENT_NAMESPACE = 'agent';

const AIR_PREFIX = 'urn:air:';
const FQDN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const SEGMENT_LITERAL_RE = /^[a-z0-9._~!$&'()*+,;=@-]$/;

export function isFqdn(value: string): boolean {
  return FQDN_RE.test(value.toLowerCase());
}

/**
 * An email as a personal short-name: trimmed and lowercased, kept verbatim
 * where URN-safe ("john@hotmail.com"), with every other character
 * percent-encoded as UTF-8 ("a#b@x.com" → "a%23b@x.com").
 */
export function emailSegment(email: string): string {
  return [...email.trim().toLowerCase()]
    .map((ch) => SEGMENT_LITERAL_RE.test(ch)
      ? ch
      : [...Buffer.from(ch, 'utf8')].map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join(''))
    .join('');
}

/** urn:air:<domain>:agent:<slug> — slug is already constrained to [a-z0-9-] by the DB. */
export function agentAirUrn(domain: string, slug: string): string {
  return `${AIR_PREFIX}${domain.toLowerCase()}:${AGENT_NAMESPACE}:${slug}`;
}

/** Card-host-anchored identifier for a domain-less individual. */
export function personalAirUrn(email: string): string {
  return `${AIR_PREFIX}${PERSONAL_CARD_HOST_DOMAIN}:${PERSONAL_NAMESPACE}:${emailSegment(email)}`;
}
