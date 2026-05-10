# Sprint 29 - Auth And Client Domain Repository

This sprint extends the domain-repository cut beyond projects and removes more of the backend write path from the global snapshot bridge.

## What changed

- `server/data/repository.mjs` now exposes explicit auth/client persistence methods:
  - `listUsers()`
  - `getUserById()`
  - `getUserByEmail()`
  - `listClients()`
  - `getClient()`
  - `upsertClient()`
  - `createSessionRecord()`
  - `getSessionRecord()`
  - `updateSessionActiveClient()`
  - `deleteSessionRecord()`
  - `cleanupExpiredSessionRecords()`
- `server/data/postgres-repository.mjs` now writes sessions and clients directly to PostgreSQL compatibility tables.
- `server/data/object-store-repository.mjs` implements the same domain contract as the transitional fallback adapter.
- `server/services/auth-service.mjs` no longer uses `writeDb(db)` for:
  - login
  - logout
  - expired session cleanup
- `server/services/client-service.mjs` no longer uses `writeDb(db)` for:
  - active workspace switch
  - workspace creation
  - brand creation
  - invite/member mutation

## Why it matters

Before this sprint, even basic auth and workspace mutations still rewrote the entire backend snapshot.

After this sprint:

- PostgreSQL-backed auth writes now persist directly to `sessions`.
- PostgreSQL-backed workspace writes now persist directly to `clients`.
- audit append stays independent from full snapshot rewrites in these flows as well.

That means the dominant write path for:

- projects
- sessions
- workspaces/brands/invites

is no longer implemented as "load whole db, mutate in memory, write whole db back" when using the PostgreSQL driver.

## Still transitional

The backend is still not fully cloud-native yet.

The following are still follow-up work:

- `getSessionContext()` still hydrates `sessionRecord.db` from `readDb()` for compatibility with domains that still consume snapshot state
- document slots
- asset/folder persistence
- audit reads still use session snapshot hydration
- rollback compatibility still depends on `object-store`

## Validation

- `node --check server/services/auth-service.mjs`
- `node --check server/services/client-service.mjs`
- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`

## Next

The next sprint in this block should target:

1. audit reads through repository methods
2. document slots
3. assets/folders

That is the work needed to stop hydrating the whole snapshot in the normal request path.
