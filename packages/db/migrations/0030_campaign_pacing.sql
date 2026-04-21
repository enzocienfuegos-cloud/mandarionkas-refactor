-- 0030_campaign_pacing.sql
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS impression_goal BIGINT CHECK (impression_goal > 0),
  ADD COLUMN IF NOT EXISTS daily_budget NUMERIC(12,2) CHECK (daily_budget > 0);

CREATE INDEX IF NOT EXISTS campaigns_pacing_idx
  ON campaigns(workspace_id, start_date, end_date)
  WHERE impression_goal IS NOT NULL
    AND status NOT IN ('archived', 'draft');
