import type { FastifyInstance } from 'fastify';
import { getSql } from '../db/client.js';
import { buildConfig } from '../config.js';
import { buildIdentifier, buildPublicUrl } from '../lib/identifier.js';
import { serializeReliability } from '../lib/reliability.js';
import { PERSONAL_CARD_HOST_DOMAIN } from '../lib/airUrn.js';
import type { DbUser, DbAgentCard, A2AAgentCard } from '../types.js';

const AGENT_CARD_MEDIA_TYPE = 'application/a2a-agent-card+json';
const NANDA_EXTENSION = 'org.projectnanda';
const PERSONAL_CARD_HOST_DISPLAY_NAME = 'Host39';

type CatalogRow = DbAgentCard & {
  userEmail: string;
  userHandle: string;
  userDisplayName: string | null;
  userIdentityType: 'domain' | 'email';
  userDomain: string | null;
};

/** The ARD publisher: the SMB's own domain, or host39.org anchoring a personal user. */
function buildPublisher(user: DbUser) {
  if (user.identityType === 'domain' && user.domain) {
    return { identifier: user.domain, displayName: user.displayName ?? user.domain, identityType: 'dns' };
  }
  return { identifier: PERSONAL_CARD_HOST_DOMAIN, displayName: PERSONAL_CARD_HOST_DISPLAY_NAME, identityType: 'dns' };
}

/** Paper-shaped catalog entry; host39-specific data lives under extensions["org.projectnanda"]. */
function buildCatalogEntry(row: CatalogRow, publicBaseUrl: string) {
  const user: DbUser = {
    id:             row.userId,
    email:          row.userEmail,
    handle:         row.userHandle,
    displayName:    row.userDisplayName,
    passwordHash:   '',
    identityType:   row.userIdentityType,
    domain:         row.userDomain,
    emailVerified:  false,
    domainVerified: false,
    createdAt:      row.createdAt,
    updatedAt:      row.updatedAt,
  };
  const isPersonal = !(user.identityType === 'domain' && user.domain);

  return {
    identifier:  buildIdentifier(user, row.slug),
    type:        AGENT_CARD_MEDIA_TYPE,
    displayName: row.displayName,
    // Kept for consumers of the pre-paper catalog shape.
    mediaType:   AGENT_CARD_MEDIA_TYPE,
    url:         buildPublicUrl(user, row.slug, publicBaseUrl),
    description: row.description,
    tags:        [] as string[],
    publisher:   buildPublisher(user),
    extensions: {
      [NANDA_EXTENSION]: {
        agentCardHost: PERSONAL_CARD_HOST_DOMAIN,
        ...(row.providerName ? { 'runtime.provider': row.providerName } : {}),
        ...(row.runtimeUrl ? { 'runtime.url': row.runtimeUrl } : {}),
        ...(isPersonal ? { subjectAccount: user.email } : {}),
        ...(row.monitoringEnabled && row.reliability
          ? {
              reliability: {
                verdict:           row.reliability.verdict,
                uptime_pct:        row.reliability.uptimePct,
                reliability_label: row.reliability.reliabilityLabel,
              },
            }
          : {}),
      },
    },
  };
}

function buildAgentCard(user: DbUser, card: DbAgentCard, publicUrl: string): A2AAgentCard {
  const identifier = buildIdentifier(user, card.slug);

  return {
    name:           card.displayName,
    description:    card.description,
    url:            card.runtimeUrl,
    version:        card.version,
    capabilities:   card.capabilities,
    authentication: card.authentication,
    skills:         card.skills,
    provider:
      card.providerName || card.providerUrl
        ? { organization: card.providerName, url: card.providerUrl }
        : null,
    _meta: {
      identifier,
      publicUrl,
      hostedBy: 'host39.org',
      ...(card.monitoringEnabled && card.reliability
        ? { reliability: serializeReliability(card.reliability) }
        : {}),
    },
  };
}

export async function registerPublicRoutes(fastify: FastifyInstance): Promise<void> {
  const sql = getSql();
  const config = buildConfig();

  // IMPORTANT: Register /personal/:handle/:slug.json BEFORE /:domain/:slug.json
  // so Fastify matches the more specific route first.

  // GET /personal/:handle/:slug.json — personal (email-identity) user card
  fastify.get<{ Params: { handle: string; slug: string } }>(
    '/personal/:handle/:slug.json',
    {
      schema: {
        tags: ['public'],
        summary: 'Get agent card for a personal (email-identity) user',
        params: {
          type: 'object',
          properties: {
            handle: { type: 'string' },
            slug:   { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { handle, slug } = request.params;

      // Only verified emails are served — the card exposes the per-email identifier.

      const [user] = await sql<DbUser[]>`
        SELECT id, email, handle, display_name, identity_type, domain
        FROM users
        WHERE handle = ${handle} AND email_verified = TRUE
      `;

      if (!user) {
        return reply.code(404).send({ error: 'NOT_FOUND', detail: 'user not found' });
      }

      const [card] = await sql<DbAgentCard[]>`
        SELECT * FROM agent_cards
        WHERE user_id = ${user.id} AND slug = ${slug} AND status = 'active' AND is_public = TRUE
      `;

      if (!card) {
        return reply.code(404).send({ error: 'NOT_FOUND', detail: 'agent card not found' });
      }

      const publicUrl = buildPublicUrl(user, card.slug, config.publicBaseUrl);
      const agentCard = buildAgentCard(user, card, publicUrl);

      reply.header('Content-Type', AGENT_CARD_MEDIA_TYPE);
      return reply.send(agentCard);
    },
  );

  // GET /:domain/:slug.json — domain-identity user card (SMB)
  fastify.get<{ Params: { domain: string; slug: string } }>(
    '/:domain/:slug.json',
    {
      schema: {
        tags: ['public'],
        summary: 'Get agent card for a domain-identity user (SMB)',
        params: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            slug:   { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const domain = request.params.domain.toLowerCase();

      // Only a verified email whose holder proved ownership via DNS TXT is served under /<domain>/.
      const [user] = await sql<DbUser[]>`
        SELECT id, email, display_name, identity_type, domain
        FROM users
        WHERE identity_type = 'domain' AND domain = ${domain} AND domain_verified = TRUE AND email_verified = TRUE
      `;

      if (!user) {
        return reply.code(404).send({ error: 'NOT_FOUND', detail: 'domain not found' });
      }

      const [card] = await sql<DbAgentCard[]>`
        SELECT * FROM agent_cards
        WHERE user_id = ${user.id} AND slug = ${slug} AND status = 'active' AND is_public = TRUE
      `;

      if (!card) {
        return reply.code(404).send({ error: 'NOT_FOUND', detail: 'agent card not found' });
      }

      const publicUrl = buildPublicUrl(user, card.slug, config.publicBaseUrl);
      const agentCard = buildAgentCard(user, card, publicUrl);

      reply.header('Content-Type', AGENT_CARD_MEDIA_TYPE);
      return reply.send(agentCard);
    },
  );

  // GET /.well-known/ai-catalog.json — aggregate catalog of all active cards
  fastify.get(
    '/.well-known/ai-catalog.json',
    {
      schema: {
        tags: ['public'],
        summary: 'Aggregate catalog of all active agent cards',
      },
    },
    async (_request, reply) => {
      // Same gates as the card routes: verified email, and verified domain for SMB.
      const rows = await sql<CatalogRow[]>`
        SELECT
          ac.*,
          u.email         AS user_email,
          u.handle        AS user_handle,
          u.display_name  AS user_display_name,
          u.identity_type AS user_identity_type,
          u.domain        AS user_domain
        FROM agent_cards ac
        JOIN users u ON u.id = ac.user_id
        WHERE ac.status = 'active' AND ac.is_public = TRUE
          AND u.email_verified = TRUE
          AND (u.identity_type <> 'domain' OR u.domain_verified = TRUE)
        ORDER BY ac.created_at DESC
      `;

      const entries = rows.map((row) => buildCatalogEntry(row, config.publicBaseUrl));

      reply.header('Content-Type', 'application/json');
      return reply.send({ specVersion: '1.0', entries });
    },
  );
}
