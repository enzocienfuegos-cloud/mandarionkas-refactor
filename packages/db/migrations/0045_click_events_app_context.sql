-- Migration 0045: persist app context on click events
--
-- App reporting already has app context on impressions. Clicks need the same
-- dimensions so app inventory can report CTR instead of always showing zero.

ALTER TABLE click_events
  ADD COLUMN IF NOT EXISTS app_id TEXT,
  ADD COLUMN IF NOT EXISTS app_bundle TEXT,
  ADD COLUMN IF NOT EXISTS app_name TEXT;

CREATE INDEX IF NOT EXISTS click_events_app_bundle_ts_idx
  ON click_events (workspace_id, app_bundle, timestamp DESC)
  WHERE app_bundle IS NOT NULL;

CREATE INDEX IF NOT EXISTS click_events_app_name_ts_idx
  ON click_events (workspace_id, app_name, timestamp DESC)
  WHERE app_name IS NOT NULL;

WITH matched_clicks AS (
  SELECT
    ce.id,
    latest_impression.app_id,
    latest_impression.app_bundle,
    latest_impression.app_name
  FROM click_events ce
  JOIN LATERAL (
    SELECT ie.app_id, ie.app_bundle, ie.app_name
    FROM impression_events ie
    WHERE ie.workspace_id = ce.workspace_id
      AND ie.tag_id = ce.tag_id
      AND ie.timestamp <= ce.timestamp
      AND ie.timestamp >= ce.timestamp - INTERVAL '24 hours'
      AND (
        (ce.device_id IS NOT NULL AND ie.device_id = ce.device_id)
        OR (ce.ip IS NOT NULL AND ie.ip = ce.ip)
      )
      AND (COALESCE(ie.app_id, '') <> '' OR COALESCE(ie.app_bundle, '') <> '' OR COALESCE(ie.app_name, '') <> '')
    ORDER BY ie.timestamp DESC
    LIMIT 1
  ) latest_impression ON true
  WHERE COALESCE(ce.app_id, '') = ''
    AND COALESCE(ce.app_bundle, '') = ''
    AND COALESCE(ce.app_name, '') = ''
)
UPDATE click_events ce
SET
  app_id = COALESCE(NULLIF(matched_clicks.app_id, ''), ce.app_id),
  app_bundle = COALESCE(NULLIF(matched_clicks.app_bundle, ''), ce.app_bundle),
  app_name = COALESCE(NULLIF(matched_clicks.app_name, ''), ce.app_name)
FROM matched_clicks
WHERE ce.id = matched_clicks.id;
