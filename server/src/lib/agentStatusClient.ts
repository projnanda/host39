import { createHmac } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../config.js';
import type { Reliability, RawReliability } from '../types.js';
import { parseReliability } from './reliability.js';

type AgentStatusConfig = Config['agentStatus'];

export function isConfigured(config: AgentStatusConfig): boolean {
  return Boolean(config.webhookSecret && config.statusApiToken);
}

function signBody(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export interface CardPublishedEvent {
  locator: string;
  agentCardUrl: string;
  displayName: string;
  status: 'active' | 'inactive';
  ownerEmail: string;
  enable: boolean;
}

export async function notifyCardPublished(
  config: AgentStatusConfig,
  event: CardPublishedEvent,
  log: FastifyBaseLogger,
): Promise<Reliability | null> {
  if (!isConfigured(config)) {
    log.warn('AgentStatus not configured — skipping card-published webhook');
    return null;
  }

  const body = JSON.stringify({
    event: event.enable ? 'monitoring.enabled' : 'monitoring.disabled',
    locator: event.locator,
    enable_monitoring: event.enable,
    agent_card_url: event.agentCardUrl,
    display_name: event.displayName,
    status: event.status,
    owner_email: event.ownerEmail,
  });

  try {
    const res = await fetch(`${config.apiBaseUrl}/api/partner/nanda/webhooks/card-published`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Nanda-Signature': `sha256=${signBody(config.webhookSecret, body)}`,
      },
      body,
    });

    if (!res.ok) {
      log.warn({ status: res.status }, 'AgentStatus card-published webhook returned non-OK status');
      return null;
    }

    const data = (await res.json()) as { reliability?: RawReliability };
    return data.reliability ? parseReliability(data.reliability) : null;
  } catch (err) {
    log.warn({ err }, 'AgentStatus card-published webhook failed');
    return null;
  }
}

async function getWithToken(
  config: AgentStatusConfig,
  path: string,
  log: FastifyBaseLogger,
): Promise<Reliability | null> {
  if (!isConfigured(config)) return null;

  try {
    const res = await fetch(`${config.apiBaseUrl}${path}`, {
      headers: { 'X-Nanda-Api-Token': config.statusApiToken },
    });

    if (!res.ok) {
      log.warn({ status: res.status, path }, 'AgentStatus poll returned non-OK status');
      return null;
    }

    const data = (await res.json()) as { reliability?: RawReliability };
    return data.reliability ? parseReliability(data.reliability) : null;
  } catch (err) {
    log.warn({ err, path }, 'AgentStatus poll failed');
    return null;
  }
}

export function fetchStatus(
  config: AgentStatusConfig,
  locator: string,
  log: FastifyBaseLogger,
): Promise<Reliability | null> {
  return getWithToken(config, `/api/partner/nanda/agents/${encodeURIComponent(locator)}/status`, log);
}

export function fetchRegistration(
  config: AgentStatusConfig,
  locator: string,
  log: FastifyBaseLogger,
): Promise<Reliability | null> {
  return getWithToken(config, `/api/partner/nanda/agents/${encodeURIComponent(locator)}/registration`, log);
}
