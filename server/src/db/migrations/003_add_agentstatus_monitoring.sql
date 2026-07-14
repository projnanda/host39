-- Add AgentStatus (agentstatus.dev) reliability monitoring support to agent_cards.

ALTER TABLE agent_cards ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE agent_cards ADD COLUMN IF NOT EXISTS agentstatus_locator VARCHAR(512);
ALTER TABLE agent_cards ADD COLUMN IF NOT EXISTS reliability JSONB;
