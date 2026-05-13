-- Migration 0044: connection signals for reporting
--
-- Browser support varies, but when available the tracker can capture whether
-- an impression came from wifi/cellular/none plus the browser's effective
-- connection class. Carrier/ISP macros continue to populate the existing
-- carrier and network_id fields.

ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS connection_type TEXT,
  ADD COLUMN IF NOT EXISTS effective_connection_type TEXT,
  ADD COLUMN IF NOT EXISTS connection_downlink_mbps NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS connection_rtt_ms INTEGER,
  ADD COLUMN IF NOT EXISTS connection_save_data BOOLEAN;

CREATE INDEX IF NOT EXISTS impression_events_connection_type_idx
  ON impression_events (connection_type);

CREATE INDEX IF NOT EXISTS impression_events_effective_connection_type_idx
  ON impression_events (effective_connection_type);
