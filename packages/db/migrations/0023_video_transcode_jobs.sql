-- Migration 0023: Video Transcode Jobs — canonical state machine
--
-- S44 replaces the heuristic-heavy approach where transcode state was
-- reconstructed from four different sources:
--   1. asset_processing_jobs (generic job queue)
--   2. creative_versions.metadata.videoProcessing (JSON blob)
--   3. video_renditions rows
--   4. API-side autorepair heuristics on GET
--
-- This migration adds a dedicated video_transcode_jobs table with:
--   - Explicit, enumerated states (pending → claimed → processing → done|failed|stalled)
--   - One row per creative version transcode attempt
--   - Deterministic state transitions enforced by constraints
--   - Stalled detection index (processing + updated_at threshold)
--   - FK to creative_versions so cascade delete works correctly
--
-- The existing asset_processing_jobs table is NOT removed — it still handles
-- image-derivatives and other job types. Video transcode jobs are MIGRATED
-- from asset_processing_jobs to video_transcode_jobs for pending jobs only.
-- Completed/failed jobs in asset_processing_jobs are left as historical data.

CREATE TABLE IF NOT EXISTS video_transcode_jobs (
  id                    TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id          TEXT        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creative_version_id   TEXT        NOT NULL REFERENCES creative_versions(id) ON DELETE CASCADE,
  asset_id              TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'processing', 'done', 'failed', 'stalled')),
  attempts              INTEGER     NOT NULL DEFAULT 0,
  max_attempts          INTEGER     NOT NULL DEFAULT 3,
  source_url            TEXT        NOT NULL,
  source_storage_key    TEXT,
  target_plan           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  output                JSONB,
  error_message         TEXT,
  error_detail          JSONB,
  priority              INTEGER     NOT NULL DEFAULT 100,
  available_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at            TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  stalled_at            TIMESTAMPTZ,
  created_by            TEXT        REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS video_transcode_jobs_active_version_idx
  ON video_transcode_jobs (creative_version_id)
  WHERE status IN ('pending', 'claimed', 'processing');

CREATE INDEX IF NOT EXISTS video_transcode_jobs_claim_idx
  ON video_transcode_jobs (status, priority ASC, available_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS video_transcode_jobs_stalled_check_idx
  ON video_transcode_jobs (status, updated_at ASC)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS video_transcode_jobs_version_idx
  ON video_transcode_jobs (creative_version_id, created_at DESC);

CREATE INDEX IF NOT EXISTS video_transcode_jobs_workspace_idx
  ON video_transcode_jobs (workspace_id, created_at DESC);

INSERT INTO video_transcode_jobs (
  id,
  workspace_id,
  creative_version_id,
  asset_id,
  status,
  attempts,
  max_attempts,
  source_url,
  source_storage_key,
  target_plan,
  priority,
  available_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid()::text,
  workspace_id,
  input->>'creativeVersionId',
  asset_id,
  'pending',
  0,
  GREATEST(max_attempts - attempts, 1),
  COALESCE(input->>'publicUrl', ''),
  input->>'storageKey',
  COALESCE(input->'targetPlan', '[]'::jsonb),
  priority,
  COALESCE(available_at, NOW()),
  created_at,
  updated_at
FROM asset_processing_jobs
WHERE job_type = 'video-transcode'
  AND status = 'pending'
  AND input->>'creativeVersionId' IS NOT NULL
  AND input->>'publicUrl' IS NOT NULL
  AND input->>'publicUrl' != ''
ON CONFLICT DO NOTHING;

UPDATE asset_processing_jobs
SET
  status = 'completed',
  output = '{"migrated": true, "migratedTo": "video_transcode_jobs", "migratedAt": "' ||
    TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '"}'::jsonb,
  completed_at = NOW(),
  updated_at = NOW()
WHERE job_type = 'video-transcode'
  AND status = 'pending'
  AND input->>'creativeVersionId' IS NOT NULL
  AND input->>'publicUrl' IS NOT NULL
  AND input->>'publicUrl' != '';
