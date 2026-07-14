import type { DbUser } from '../types.js';

export function buildIdentifier(user: DbUser, slug: string): string {
  if (user.identityType === 'domain' && user.domain) {
    return `urn:ai:domain:${user.domain}:agent:${slug}`;
  }
  return `urn:ai:email:${user.email}:agent:${slug}`;
}

export function buildPublicUrl(user: DbUser, slug: string, baseUrl: string): string {
  if (user.identityType === 'domain' && user.domain) {
    return `${baseUrl}/${user.domain}/${slug}.json`;
  }
  return `${baseUrl}/personal/${user.handle}/${slug}.json`;
}
