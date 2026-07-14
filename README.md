# host39

Managed A2A agent card hosting for small businesses and individuals. Publish a standardized agent card at a stable public URL without running your own server.

In the resolution chain, host39 is **hop 2** for SMB and personal registrations:

```
Requester → NANDA Index → agentcards.host39.org/<domain>/<slug>.json → Agent Runtime
```

---

## What it does

- **SMBs:** Register with your domain, create agent cards, serve them at `agentcards.host39.org/<domain>/<slug>.json`
- **Individuals:** Register with your email, create agent cards, serve them at `agentcards.host39.org/personal/<handle>/<slug>.json`
- Serves `/.well-known/ai-catalog.json` as an aggregate AI Catalog of all active cards
- Web dashboard for managing cards
- No server required for your agents
- Optional agent reliability monitoring via [AgentStatus](https://agentstatus.dev) — enable a checkbox on any card to get an uptime badge and public reliability report

---

## Stack

- **API:** Fastify 5, TypeScript, Node.js 20
- **Database:** PostgreSQL 16, postgres.js v3
- **Frontend:** Next.js 16, TailwindCSS v4
- **Auth:** Email/password, JWT
- **Proxy:** Caddy 2 (TLS auto-provisioned)

---

## Public URL Structure

| Identity type | Public card URL |
|--------------|----------------|
| SMB (domain) | `https://agentcards.host39.org/<domain>/<slug>.json` |
| Personal (email) | `https://agentcards.host39.org/personal/<handle>/<slug>.json` |

Examples:
```
https://agentcards.host39.org/moonbakery.com/orders.json
https://agentcards.host39.org/personal/john/agent.json
```

---

## Local Development

```bash
git clone https://github.com/your-org/host39
cd host39
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---------|-----|
| Web UI  | http://localhost:3002 |
| API     | http://localhost:3010 |

---

## Production Deployment

### Prerequisites

- VPS with 2GB RAM (add swap on 1GB servers)
- Docker and Docker Compose installed
- Two DNS A records pointing to your server:
  - `host39.org` → server IP (dashboard and API)
  - `agentcards.host39.org` → server IP (public card serving)

### Steps

```bash
# 1. Clone
git clone https://github.com/your-org/host39
cd host39

# 2. Configure
cp .env.prod.example .env.prod
# Edit .env.prod and fill in all values

# 3. Build and start
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d

# 4. Verify
curl https://host39.org/health
curl https://agentcards.host39.org/.well-known/ai-catalog.json
```

### Caddyfile

The production Caddyfile routes traffic between the dashboard and the public card server:

```caddy
host39.org {
  handle /auth* { reverse_proxy server:3010 }
  handle /cards* { reverse_proxy server:3010 }
  handle /health* { reverse_proxy server:3010 }
  handle /.well-known/* { reverse_proxy server:3010 }
  handle { reverse_proxy web:3002 }
}

agentcards.host39.org {
  reverse_proxy server:3010
}
```

### Environment Variables

```env
# Database
POSTGRES_PASSWORD=          # strong random password

# JWT — generate with: openssl rand -hex 64
JWT_SECRET=
JWT_EXPIRES_IN=7d

# Frontend origin
FRONTEND_URL=https://host39.org

# Baked into Next.js build
NEXT_PUBLIC_HOST39_API_URL=https://host39.org
NEXT_PUBLIC_HOST39_PUBLIC_BASE_URL=https://agentcards.host39.org

# AgentStatus (agentstatus.dev) reliability monitoring — shared out-of-band by
# AgentStatus. Leave blank to keep the monitoring checkbox a no-op.
NANDA_WEBHOOK_SECRET=
NANDA_STATUS_API_TOKEN=
AGENTSTATUS_API_BASE_URL=https://api.rora.carmel.so
AGENTSTATUS_POLL_INTERVAL_MS=120000
```

---

## Registering and Publishing an Agent Card

### Step 1: Create an account

```bash
# SMB (domain identity)
curl -X POST https://host39.org/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@moonbakery.com",
    "password": "yourpassword",
    "handle": "moonbakery",
    "display_name": "Moon Bakery",
    "identity_type": "domain",
    "domain": "moonbakery.com"
  }'
# Returns: { "token": "eyJ..." }

# Personal (email identity)
curl -X POST https://host39.org/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@hotmail.com",
    "password": "yourpassword",
    "handle": "john",
    "display_name": "John",
    "identity_type": "email"
  }'
```

### Step 2: Create an agent card

```bash
TOKEN="eyJ..."

curl -X POST https://host39.org/cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "slug": "orders",
    "display_name": "Moon Bakery Orders Agent",
    "description": "Place and track orders at Moon Bakery.",
    "runtime_url": "https://orders.moonbakery.com/agent",
    "version": "1.0",
    "capabilities": { "streaming": false, "pushNotifications": false },
    "authentication": { "schemes": ["Bearer"] },
    "provider_name": "Moon Bakery",
    "provider_url": "https://moonbakery.com"
  }'
```

The card is now live at:
```
https://agentcards.host39.org/moonbakery.com/orders.json
```

### Step 3: Register in NANDA Index

```bash
curl -X POST https://api.nandaindex.org/api/v1/orgs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <nanda-index-token>" \
  -d '{
    "org_id": "moon-bakery",
    "display_name": "Moon Bakery",
    "hosting_path": "smb",
    "domain": "moonbakery.com",
    "contact_email": "admin@moonbakery.com",
    "registry_url": "https://agentcards.host39.org/moonbakery.com/orders.json",
    "identifier": "urn:ai:domain:moonbakery.com:agent:orders",
    "media_type": "application/a2a-agent-card+json",
    "publisher": {
      "identifier": "urn:ai:domain:moonbakery.com",
      "displayName": "Moon Bakery",
      "identityType": "dns"
    },
    "catalog_metadata": {
      "org.projectnanda.preferredDiscovery": "nandaindex",
      "org.projectnanda.resolutionRole": "smb-agent-card",
      "org.projectnanda.agentCardHost": "agentcards.host39.org"
    }
  }'
```

Now `urn:ai:domain:moonbakery.com:agent:orders` resolves end-to-end.

---

## Agent Reliability Monitoring (AgentStatus)

Any card can opt into third-party uptime monitoring via
[AgentStatus](https://agentstatus.dev), toggled with the `monitoring_enabled`
field (a checkbox in the dashboard forms).

- When enabled, host39 signs and sends a `card-published` webhook
  (HMAC-SHA256 over the JSON body, `X-Nanda-Signature` header) to
  AgentStatus's partner API, identifying the card by its NANDA URN
  (`urn:ai:domain:<domain>:agent:<slug>` or `urn:ai:email:<email>:agent:<slug>`)
  and its own public card URL (`agent_card_url`) — **not** the card's
  `runtime_url`. AgentStatus fetches the card from `agent_card_url` and reads
  `runtime_url` from inside it to know what to probe.
- The returned `reliability` object (verdict, uptime %, pass rate, and
  report/badge/claim links) is cached on the card and re-polled every
  `AGENTSTATUS_POLL_INTERVAL_MS` (default 2 min).
- Reliability data is surfaced on the dashboard, the edit page, and in the
  public card JSON / `.well-known/ai-catalog.json`.
- Without `NANDA_WEBHOOK_SECRET` / `NANDA_STATUS_API_TOKEN` configured, the
  checkbox still works but monitoring stays in a "pending setup" state
  (`reliability: null`) — no outbound calls are made.
- `agent_card_url` is built from `PUBLIC_BASE_URL`, so it must be a
  publicly-reachable address (e.g. `https://agentcards.host39.org`) for
  AgentStatus to actually fetch the card — this doesn't work against
  `localhost` in local dev without a tunnel.

---

## Schema

### Agent Card (public response)

```typescript
interface A2AAgentCard {
  name:           string;
  description:    string | null;
  url:            string;          // runtime endpoint
  version:        string;
  capabilities:   { streaming: boolean; pushNotifications: boolean };
  authentication: { schemes: string[] };
  skills:         Array<{ name: string; description?: string }>;
  provider: {
    organization: string | null;
    url:          string | null;
  };
  _meta: {
    identifier: string;   // URN
    publicUrl:  string;   // this card's URL on agentcards.host39.org
    hostedBy:   string;   // "host39.org"
    reliability?: {       // present only when monitoring is enabled and data has arrived
      provider: string; monitoring: string; verdict: string; status: string;
      uptime_pct: number; pass_rate: number; last_checked_at: string;
      reliability_label: string; report_url: string; badge_url: string; claim_url: string;
    };
  };
}
```

### Database tables

```sql
-- User accounts
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  display_name  VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  handle        VARCHAR(32) UNIQUE NOT NULL,  -- used in public URLs
  identity_type VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (identity_type IN ('domain','email')),
  domain        VARCHAR(255) UNIQUE,           -- SMB users only
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent cards
CREATE TABLE agent_cards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug           VARCHAR(64) NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  display_name   VARCHAR(255) NOT NULL,
  description    TEXT,
  runtime_url    VARCHAR(512),
  version        VARCHAR(32) DEFAULT '1.0',
  capabilities   JSONB NOT NULL DEFAULT '{"streaming":false,"pushNotifications":false}',
  authentication JSONB NOT NULL DEFAULT '{"schemes":["none"]}',
  skills         JSONB NOT NULL DEFAULT '[]',
  provider_name  VARCHAR(255),
  provider_url   VARCHAR(512),
  status         VARCHAR(20) NOT NULL DEFAULT 'active',
  is_public      BOOLEAN NOT NULL DEFAULT TRUE,
  monitoring_enabled  BOOLEAN NOT NULL DEFAULT FALSE,  -- AgentStatus reliability monitoring
  agentstatus_locator VARCHAR(512),                    -- NANDA URN, set once monitoring is enabled
  reliability         JSONB,                            -- cached AgentStatus response
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);
```

---

## API Reference

### Auth

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | `{ email, password, handle, display_name?, identity_type?, domain? }` | Create account |
| `POST` | `/auth/login` | `{ email, password }` | Sign in |
| `GET`  | `/auth/me` | — | Current user |

**handle** must match `^[a-z0-9][a-z0-9-]{1,31}$` and is used in your public card URLs.

### Cards (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/cards` | List your cards |
| `POST`   | `/cards` | Create a card |
| `GET`    | `/cards/:id` | Get a card |
| `PUT`    | `/cards/:id` | Update a card |
| `DELETE` | `/cards/:id` | Delete a card |

Cards accept an optional `monitoring_enabled` boolean in the create/update
body; responses include `monitoring_enabled`, `agentstatus_locator`, and
`reliability` (see [Agent Reliability Monitoring](#agent-reliability-monitoring-agentstatus)).

### Public card serving (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/personal/:handle/:slug.json` | Personal user card |
| `GET` | `/:domain/:slug.json` | SMB domain user card |
| `GET` | `/.well-known/ai-catalog.json` | Aggregate catalog of all active cards |

All public card endpoints respond with `Content-Type: application/a2a-agent-card+json`.

---

## Health Check

```bash
curl https://host39.org/health
# { "status": "ok" }
```
