# Sprint 35 - Legacy Lane Naming

This sprint makes the remaining compatibility/legacy backend lane explicit in naming, not just in architecture notes.

## What changed

- renamed `server/services/storage-admin-service.mjs` to `server/services/compatibility-admin-service.mjs`
- updated `server/server.mjs` to import compatibility/admin flows from the renamed service
- updated README references so the repo no longer presents storage diagnostics/admin compatibility flows as part of the normal product service layer

## Why it matters

At this stage, the main product request path is already much more domain-oriented and cloud-leaning.

What remained was a naming problem:

- compatibility logic still sounded like a normal backend service
- the codebase still implied that storage diagnostics/rebuild/sidecar housekeeping belonged in the same conceptual layer as product features

Renaming the service makes the architecture more honest:

- product services stay product-oriented
- compatibility tooling is visibly legacy/rollback/admin infrastructure

That matters for future cleanup because it reduces the chance that new work keeps extending the compatibility lane by accident.

## Validation

- `node --check server/services/compatibility-admin-service.mjs`
- `node --check server/server.mjs`
- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`

## Still transitional

The remaining explicit compatibility surface is now concentrated in:

- `server/services/compatibility-admin-service.mjs`
- `server/data/compatibility-repository.mjs`
- sidecar/index tooling
- `object-store` compatibility mode

## Next

The next sprint should focus on reducing the size of that remaining compatibility surface:

1. split diagnostics vs mutation/repair paths
2. decide which compatibility/admin endpoints must survive long term
3. define the deletion path for sidecar rebuild logic once PostgreSQL is fully trusted as the only metadata source
