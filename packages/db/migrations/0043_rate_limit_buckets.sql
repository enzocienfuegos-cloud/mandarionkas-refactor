-- Migration 0043: shared Postgres rate-limit buckets
--
-- Upload rate limiting must work across multiple API instances. The old
-- in-memory limiter is process-local, so this table stores fixed-window bucket
-- state in Postgres and lets API routes coordinate through advisory locks.

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 0,
  reset_at   TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_reset_at_idx
  ON rate_limit_buckets(reset_at);
