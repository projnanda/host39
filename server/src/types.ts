export interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface DbUser {
  id: string;
  email: string;
  handle: string;
  displayName: string | null;
  passwordHash: string;
  identityType: 'domain' | 'email';
  domain: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbAgentCard {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  description: string | null;
  runtimeUrl: string | null;
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
  };
  authentication: {
    schemes: string[];
  };
  skills: AgentSkill[];
  providerName: string | null;
  providerUrl: string | null;
  status: 'active' | 'inactive';
  isPublic: boolean;
  monitoringEnabled: boolean;
  agentstatusLocator: string | null;
  reliability: Reliability | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Internal representation, kept camelCase to match postgres.js's `postgres.camel`
 * transform (which recursively camelCases JSONB content read back from the DB).
 * Converted to/from the wire (snake_case) shape at the API boundaries — see
 * `lib/reliability.ts`.
 */
export interface Reliability {
  provider: string;
  monitoring: string;
  verdict: string;
  status: string;
  uptimePct: number;
  passRate: number;
  lastCheckedAt: string;
  reliabilityLabel: string;
  reportUrl: string;
  badgeUrl: string;
  claimUrl: string;
}

/** Wire shape (snake_case) — what AgentStatus sends/expects, and what host39's own APIs emit. */
export interface RawReliability {
  provider: string;
  monitoring: string;
  verdict: string;
  status: string;
  uptime_pct: number;
  pass_rate: number;
  last_checked_at: string;
  reliability_label: string;
  report_url: string;
  badge_url: string;
  claim_url: string;
}

export interface AgentSkill {
  id?: string;
  name: string;
  description?: string;
  tags?: string[];
}

export interface A2AAgentCard {
  name: string;
  description: string | null;
  url: string | null;
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
  };
  authentication: {
    schemes: string[];
  };
  skills: AgentSkill[];
  provider: {
    organization: string | null;
    url: string | null;
  } | null;
  _meta: {
    identifier: string;
    publicUrl: string;
    hostedBy: string;
    reliability?: RawReliability;
  };
}
