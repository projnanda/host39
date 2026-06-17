/**
 * Seed script for local development.
 * Wipes users + agent_cards and inserts 2 SMB + 2 personal test accounts.
 *
 * Usage:
 *   DATABASE_URL=postgresql://host39:host39-local@localhost:5433/host39 npx tsx src/scripts/seed.ts
 */

import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const PASSWORD = 'Test1234!';
const BCRYPT_ROUNDS = 12;

const sql = postgres(process.env.DATABASE_URL!, { transform: postgres.camel });

async function seed() {
  const hash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);

  // Wipe
  await sql`TRUNCATE agent_cards, users RESTART IDENTITY CASCADE`;

  // ── SMB 1: Moon Bakery ────────────────────────────────────────────────────
  const [mb] = await sql<[{id: string}]>`
    INSERT INTO users (email, handle, display_name, password_hash, identity_type, domain)
    VALUES ('admin@moonbakery.com', 'moonbakery', 'Moon Bakery', ${hash}, 'domain', 'moonbakery.com')
    RETURNING id
  `;
  await sql`
    INSERT INTO agent_cards (user_id, slug, display_name, description, runtime_url, version,
      capabilities, authentication, skills, provider_name, provider_url, is_public)
    VALUES (
      ${mb.id}, 'orders', 'Orders Agent',
      'Place and track bakery orders via A2A.',
      'https://agents.moonbakery.com/orders',
      '1.0',
      ${sql.json({ streaming: false, pushNotifications: true })},
      ${sql.json({ schemes: ['Bearer'] })},
      ${sql.json([
        { name: 'placeOrder', description: 'Place a new order' },
        { name: 'trackOrder', description: 'Check order status' },
      ])},
      'Moon Bakery', 'https://moonbakery.com', true
    )
  `;

  // ── SMB 2: TechCorp ───────────────────────────────────────────────────────
  const [tc] = await sql<[{id: string}]>`
    INSERT INTO users (email, handle, display_name, password_hash, identity_type, domain)
    VALUES ('admin@techcorp.io', 'techcorp', 'TechCorp', ${hash}, 'domain', 'techcorp.io')
    RETURNING id
  `;
  await sql`
    INSERT INTO agent_cards (user_id, slug, display_name, description, runtime_url, version,
      capabilities, authentication, skills, provider_name, provider_url, is_public)
    VALUES (
      ${tc.id}, 'support', 'Support Agent',
      'AI-powered customer support for TechCorp products.',
      'https://agents.techcorp.io/support',
      '1.0',
      ${sql.json({ streaming: true, pushNotifications: false })},
      ${sql.json({ schemes: ['OAuth2'] })},
      ${sql.json([
        { name: 'openTicket',  description: 'Open a support ticket' },
        { name: 'checkStatus', description: 'Check ticket status' },
        { name: 'escalate',    description: 'Escalate to human agent' },
      ])},
      'TechCorp', 'https://techcorp.io', true
    )
  `;

  // ── Personal 1: Ankit ─────────────────────────────────────────────────────
  const [an] = await sql<[{id: string}]>`
    INSERT INTO users (email, handle, display_name, password_hash, identity_type)
    VALUES ('ankit@test.com', 'ankit', 'Ankit', ${hash}, 'email')
    RETURNING id
  `;
  await sql`
    INSERT INTO agent_cards (user_id, slug, display_name, description, runtime_url, version,
      capabilities, authentication, skills, is_public)
    VALUES (
      ${an.id}, 'assistant', 'Personal Assistant',
      'A general-purpose AI assistant for productivity.',
      'https://ankit.railway.app/agent',
      '1.0',
      ${sql.json({ streaming: true, pushNotifications: false })},
      ${sql.json({ schemes: ['none'] })},
      ${sql.json([{ name: 'assist', description: 'Help with any task' }])},
      true
    )
  `;

  // ── Personal 2: Jane ──────────────────────────────────────────────────────
  const [jn] = await sql<[{id: string}]>`
    INSERT INTO users (email, handle, display_name, password_hash, identity_type)
    VALUES ('jane@test.com', 'jane', 'Jane', ${hash}, 'email')
    RETURNING id
  `;
  await sql`
    INSERT INTO agent_cards (user_id, slug, display_name, description, runtime_url, version,
      capabilities, authentication, skills, is_public)
    VALUES (
      ${jn.id}, 'research', 'Research Agent',
      'Deep research and literature synthesis.',
      null,
      '1.0',
      ${sql.json({ streaming: false, pushNotifications: false })},
      ${sql.json({ schemes: ['Bearer'] })},
      ${sql.json([
        { name: 'search',    description: 'Search and summarise sources' },
        { name: 'synthesise', description: 'Synthesise findings into a report' },
      ])},
      true
    )
  `;

  await sql.end();

  console.log('✓ Seeded 4 users and 4 agent cards');
  console.log('');
  console.log('Test credentials (all use the same password):');
  console.log('  admin@moonbakery.com  /  Test1234!  (SMB · moonbakery.com)');
  console.log('  admin@techcorp.io     /  Test1234!  (SMB · techcorp.io)');
  console.log('  ankit@test.com        /  Test1234!  (personal · @ankit)');
  console.log('  jane@test.com         /  Test1234!  (personal · @jane)');
}

seed().catch((err) => { console.error(err); process.exit(1); });
