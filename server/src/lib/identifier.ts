import type { DbUser } from '../types.js';
import { agentAirUrn, personalAirUrn } from './airUrn.js';

/**
 * NANDA Index identifier for a card.
 *
 * Personal users: the index issues exactly ONE identifier per email
 * (urn:air:host39.org:personal:<email>), but host39 lets a personal user host
 * many cards. Every personal card therefore carries the user's single personal
 * identifier — only one of them can be the card the index entry points at
 * (its registry_url). We deliberately don't invent a per-card form the index
 * would reject.
 */
export function buildIdentifier(user: DbUser, slug: string): string {
  if (user.identityType === 'domain' && user.domain) {
    return agentAirUrn(user.domain, slug);
  }
  return personalAirUrn(user.email);
}

export function buildPublicUrl(user: DbUser, slug: string, baseUrl: string): string {
  if (user.identityType === 'domain' && user.domain) {
    return `${baseUrl}/${user.domain}/${slug}.json`;
  }
  return `${baseUrl}/personal/${user.handle}/${slug}.json`;
}
