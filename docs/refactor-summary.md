# Refactor summary

## Structural changes

- moved the editor into `apps/web`
- created `apps/api` for the new stateless backend
- created `apps/worker` for async jobs
- created `packages/config`, `packages/contracts`, `packages/db`
- moved Cloudways/PHP runtime to `legacy/cloudways`

## Frontend changes

- API base now comes from `VITE_API_BASE_URL`
- requests use `credentials: include`
- auth is no longer restored from browser storage
- app boot now calls `GET /v1/auth/session`
- workspace hub no longer shows legacy R2 sidecar maintenance UI
- document persistence is now cloud-only in API mode; the silent fallback to browser storage was removed

## Backend changes

- new health endpoints: `/healthz`, `/readyz`, `/version`
- `/readyz` now performs a real database reachability check instead of only echoing config flags
- real auth routes: `/v1/auth/session`, `/v1/auth/login`, `/v1/auth/logout`
- in-memory rate limiting added for login and upload-sensitive asset endpoints
- workspace routes now read/write PostgreSQL
- project routes now read/write PostgreSQL for list, load, save, delete, duplicate, archive, restore and owner changes
- project version routes now persist snapshot history in PostgreSQL
- cloud draft routes now persist autosave/manual snapshots in PostgreSQL
- compatibility `clients` routes still exist while the frontend terminology is being migrated, but now return deprecation headers with a sunset date
- asset routes now read/write PostgreSQL for folders, metadata, direct-url saves and upload completion
- R2 presigned upload preparation is wired in the API for direct browser uploads
- audit events now capture critical mutations across workspaces, projects, drafts and assets
- admin audit inspection endpoint added at `GET /v1/admin/audit-events`
- structured request logging and request IDs remain in place

## Worker and maintenance changes

- worker is no longer a pure stub
- maintenance job now expires stale upload sessions
- maintenance job now revokes expired auth sessions
- maintenance job now prunes old user drafts based on retention policy
- smoke-check script added for post-deploy verification against `/`, `/healthz`, `/readyz`, `/version`, `/v1/auth/health` and `/v1/assets/health`

## Data layer changes

- migration runner implemented in `packages/db/scripts/run-migrations.mjs`
- session table extended with `active_workspace_id` and `persistence_mode`
- new `user_document_drafts` table introduced for cloud autosave/manual persistence
- asset metadata now persists in `asset_folders`, `asset_upload_sessions` and `assets`
- demo seed script added in `packages/db/scripts/seed-demo-data.mjs`
- legacy import runner added in `packages/db/scripts/import-legacy-data.mjs`
- importer now produces JSON/Markdown reconciliation reports and can read split JSON, monolithic `store.json`, or direct legacy R2 data
- `audit_events` is now actively populated by runtime mutations
- R2 remains binary storage only; workspace/auth/project/asset metadata moved to PostgreSQL
