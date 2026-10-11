import { resolveTxt } from 'node:dns/promises';

/**
 * DNS TXT domain-ownership verification (ACME dns-01 style), mirroring the
 * NANDA Index (nanda-index-v2/server/src/services/domainVerification.ts) but
 * with host39's own record name so the two challenges never get confused.
 *
 * To prove control of `example.com`, the user publishes a TXT record at
 * `_host39-challenge.example.com` with value `host39-verify=<token>`.
 */

export const CHALLENGE_PREFIX = '_host39-challenge';
export const VALUE_PREFIX = 'host39-verify=';

/** How long an issued challenge stays valid — DNS propagation can be slow. */
export const CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function challengeRecordName(domain: string): string {
  return `${CHALLENGE_PREFIX}.${domain}`;
}

export function challengeRecordValue(token: string): string {
  return `${VALUE_PREFIX}${token}`;
}

/** Injectable resolver — defaults to Node's DNS, overridable in tests. */
export type TxtResolver = (name: string) => Promise<string[][]>;

export interface DomainLookupResult {
  readonly verified: boolean;
  /** Flattened TXT records observed at the challenge name (for diagnostics). */
  readonly found: readonly string[];
}

/**
 * Resolves the challenge TXT record and checks for `expectedValue`. A missing
 * record or any resolver error means "not yet verified" (a retry-able 400),
 * never a 500. Each record's chunks are joined before matching.
 */
export async function lookupDomainToken(
  domain: string,
  expectedValue: string,
  resolve: TxtResolver = resolveTxt,
): Promise<DomainLookupResult> {
  let records: string[][];
  try {
    records = await resolve(challengeRecordName(domain));
  } catch {
    return { verified: false, found: [] };
  }

  const found = records.map((chunks) => chunks.join(''));
  return { verified: found.includes(expectedValue), found };
}
