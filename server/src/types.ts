export interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface DbUser {
  id: string;
  email: string;
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
  createdAt: Date;
  updatedAt: Date;
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
  };
}
