-- 0010_reporting_views.sql
CREATE OR REPLACE VIEW tag_impression_summary AS
SELECT
  t.workspace_id,
  t.id           AS tag_id,
  t.name         AS tag_name,
  t.format,
  t.status,
  COUNT(ie.id)   AS total_impressions,
  COUNT(DISTINCT ie.ip) AS unique_ips,
  MAX(ie.timestamp)     AS last_impression_at
FROM ad_tags t
LEFT JOIN impression_events ie ON ie.tag_id = t.id
GROUP BY t.workspace_id, t.id, t.name, t.format, t.status;

CREATE OR REPLACE VIEW campaign_impression_summary AS
SELECT
  c.workspace_id,
  c.id             AS campaign_id,
  c.name           AS campaign_name,
  c.status         AS campaign_status,
  COUNT(ie.id)     AS total_impressions,
  COUNT(DISTINCT t.id) AS tag_count
FROM campaigns c
LEFT JOIN ad_tags t ON t.campaign_id = c.id
LEFT JOIN impression_events ie ON ie.tag_id = t.id
GROUP BY c.workspace_id, c.id, c.name, c.status;
