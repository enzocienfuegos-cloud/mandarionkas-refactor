-- 0018_campaigns_v2.sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS flight_type TEXT CHECK (flight_type IN ('standard','always_on','sponsorship'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS kpi TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS kpi_goal NUMERIC(12,4);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS campaigns_external_id_idx ON campaigns(workspace_id, external_id) WHERE external_id IS NOT NULL;
