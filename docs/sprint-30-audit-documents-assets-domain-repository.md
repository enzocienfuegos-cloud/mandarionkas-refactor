# Sprint 30 - Audit, Documents And Assets Domain Repository

This sprint continues the backend decoupling block by moving more normal product flows off the snapshot-style persistence path.

## What changed

- `server/data/repository.mjs` now exposes explicit domain methods for:
  - audit reads
  - document slots
  - asset folders
  - assets
- `server/data/postgres-repository.mjs` now implements direct persistence for:
  - `audit_events` queries
  - `document_slots`
  - `asset_folders`
  - `assets`
- `server/data/object-store-repository.mjs` implements the same contract as the fallback adapter.
- `server/services/audit-service.mjs` now reads audit events through repository methods instead of relying on `sessionRecord.db.auditEvents`.
- `server/services/document-service.mjs` now uses repository domain methods for:
  - save
  - load
  - existence checks
  - clear
  - stale draft cleanup
- `server/services/asset-service.mjs` now uses repository domain methods for:
  - folder creation
  - asset create
  - asset fetch
  - asset rename
  - asset delete

## Why it matters

At this point, the normal backend product flows for:

- projects
- auth/sessions
- clients/workspaces
- audit reads
- documents/drafts
- assets/folders

are no longer centered on "load full db snapshot, mutate in memory, write it all back" when the active driver is PostgreSQL.

That does **not** mean the entire backend is fully cloud-native yet, but it does mean the snapshot bridge is being pushed out of the hot path and into compatibility/admin territory.

## Still transitional

The following pieces still remain follow-up work:

- `getSessionContext()` still hydrates `sessionRecord.db` for compatibility with services and admin flows that still expect snapshot-shaped context
- storage diagnostics / rebuild / housekeeping still use `readDb()` as an admin compatibility layer
- `object-store` is still present as rollback and migration compatibility
- distributed operations are still intentionally postponed

## Validation

- `node --check server/services/document-service.mjs`
- `node --check server/services/asset-service.mjs`
- `node --check server/services/audit-service.mjs`
- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`

## Next

The next sprint in this block should focus on reducing snapshot hydration itself:

1. slim `getSessionContext()`
2. introduce a smaller session-scoped context object
3. isolate or rewrite admin/storage compatibility flows

That is the next real step toward "full cloud, no legacy in the main request path."
