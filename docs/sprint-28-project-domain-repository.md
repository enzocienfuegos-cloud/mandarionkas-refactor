# Sprint 28 - Project Domain Repository

This sprint starts the "full cloud / no legacy path in the hot path" backend block by moving project persistence away from the global `readDb()/writeDb()` snapshot pattern.

## What changed

- `server/data/repository.mjs` now exposes domain-level project persistence methods:
  - `listProjects()`
  - `getProject()`
  - `getProjectState()`
  - `upsertProject()`
  - `deleteProjectGraph()`
  - `listProjectVersions()`
  - `getProjectVersionState()`
  - `createProjectVersion()`
  - `appendAuditEventRecord()`
- `server/services/project-service.mjs` now uses those domain methods instead of mutating `sessionRecord.db` and ending every project write with `writeDb(db)`.
- `server/data/postgres-repository.mjs` now persists project saves, project versions, project deletes and audit appends directly against PostgreSQL domain tables.
- `server/data/object-store-repository.mjs` implements the same domain contract as a transitional fallback so rollback compatibility is preserved while the rest of the backend catches up.

## Why it matters

Before this sprint, project saves and project versioning still rewrote the entire backend snapshot, even when the active driver was PostgreSQL.

After this sprint:

- PostgreSQL-backed project writes are no longer implemented as a full snapshot rewrite.
- project CRUD/version operations are now expressed as domain persistence calls.
- audit persistence for the project flow can be appended without forcing a global `writeDb()`.

That is the first meaningful step from a compatibility bridge toward actual domain persistence.

## Still transitional

This sprint does **not** mean the backend is fully cloud-native yet.

The following areas still depend on the global snapshot path and remain follow-up work:

- auth/session persistence
- clients/workspaces/brands/invites
- document slots
- assets/folders
- admin audit reads still hydrate from session snapshot context

## Validation

- `node --check server/services/project-service.mjs`
- `node --check server/data/postgres-repository.mjs`
- `node --check server/data/object-store-repository.mjs`
- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`

## Next

The next sprint in this block should apply the same domain-repository cut to:

1. `clients/workspaces`
2. `auth/sessions`
3. `audit reads`

That is the path to remove the snapshot bridge from the real backend write path instead of only wrapping it better.
