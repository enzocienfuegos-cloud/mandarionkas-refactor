# Sprint 38 — Compatibility Removal

This sprint removes the remaining compatibility lane instead of just isolating or renaming it.

## Included

- runtime is now PostgreSQL-only:
  - `server/env.mjs` rejects any repository driver other than `postgres`
  - `server/data/repository.mjs` delegates only to `server/data/postgres-repository.mjs`
- deleted the compatibility runtime files:
  - `server/data/compatibility-repository.mjs`
  - `server/services/compatibility-diagnostics-service.mjs`
  - `server/services/compatibility-repair-service.mjs`
  - `server/data/object-store-repository.mjs`
- removed compatibility and rebuild endpoints from `server/server.mjs`
- kept asset housekeeping, but rewrote it as a normal admin service in `server/services/asset-admin-service.mjs`
- snapshot tooling now reads PostgreSQL directly instead of going through legacy snapshot boundaries
- removed rollback/object-store expectations from readiness and cutover scripts

## Outcome

The backend no longer carries a first-class compatibility lane in runtime configuration, repository selection or HTTP surface.

What remains is PostgreSQL metadata plus R2 binary storage.

## Validation

- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`
- `npm run platform:snapshot:smoke`

