import type { FastifyInstance } from 'fastify';
import { getSql } from '../db/client.js';
import { isConfigured, fetchStatus, fetchRegistration } from './agentStatusClient.js';
import type { Config } from '../config.js';
import type { DbAgentCard } from '../types.js';

export type StopPoller = () => void;

async function pollOnce(fastify: FastifyInstance, config: Config): Promise<void> {
  const sql = getSql();
  const rows = await sql<Pick<DbAgentCard, 'id' | 'agentstatusLocator' | 'reliability'>[]>`
    SELECT id, agentstatus_locator, reliability
    FROM agent_cards
    WHERE monitoring_enabled = TRUE AND agentstatus_locator IS NOT NULL
  `;

  for (const row of rows) {
    try {
      const locator = row.agentstatusLocator as string;
      const reliability = row.reliability
        ? await fetchStatus(config.agentStatus, locator, fastify.log)
        : await fetchRegistration(config.agentStatus, locator, fastify.log);

      if (reliability) {
        await sql`
          UPDATE agent_cards SET reliability = ${sql.json(JSON.parse(JSON.stringify(reliability)))}
          WHERE id = ${row.id}
        `;
      }
    } catch (err) {
      fastify.log.warn({ err, cardId: row.id }, 'AgentStatus poll failed for card');
    }
  }
}

export function startAgentStatusPoller(fastify: FastifyInstance, config: Config): StopPoller {
  if (!isConfigured(config.agentStatus)) {
    fastify.log.info('AgentStatus not configured — monitoring poller disabled');
    return () => {};
  }

  const interval = setInterval(() => {
    pollOnce(fastify, config).catch((err) => {
      fastify.log.warn({ err }, 'AgentStatus poll batch failed');
    });
  }, config.agentStatus.pollIntervalMs);

  return () => clearInterval(interval);
}
