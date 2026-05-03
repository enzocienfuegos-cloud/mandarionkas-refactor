-- Migration 0031: add ip_fingerprint to impression_events and click_events
-- ip_fingerprint = HMAC-SHA256(ip, daily_salt).slice(0,16)
-- Permite stitch intraday sin guardar IP raw.

ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS ip_fingerprint TEXT;

ALTER TABLE click_events
  ADD COLUMN IF NOT EXISTS ip_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS impression_events_ip_fp_idx
  ON impression_events (ip_fingerprint)
  WHERE ip_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS click_events_ip_fp_idx
  ON click_events (ip_fingerprint)
  WHERE ip_fingerprint IS NOT NULL;
