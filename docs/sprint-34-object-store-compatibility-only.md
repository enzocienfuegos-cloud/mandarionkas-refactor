# Sprint 34 - Object-Store Compatibility Only

This sprint turns `object-store` from a normal-looking runtime option into an explicitly gated compatibility mode.

## What changed

- `server/env.mjs` now treats PostgreSQL as the default steady-state repository driver.
- `PLATFORM_REPOSITORY_DRIVER=object-store` now requires:
  - `PLATFORM_OBJECT_STORE_COMPATIBILITY_MODE=true`
- without that compatibility flag, the server fails fast instead of silently treating `object-store` as a normal first-class mode.
- readiness tooling now expects:
  - `PLATFORM_REPOSITORY_DRIVER=postgres`
  - `PLATFORM_OBJECT_STORE_COMPATIBILITY_MODE=false`
- env examples and staging templates now document `object-store` as rollback/migration compatibility only.
- rollback checklist/docs now explicitly require both:
  - `PLATFORM_REPOSITORY_DRIVER=object-store`
  - `PLATFORM_OBJECT_STORE_COMPATIBILITY_MODE=true`

## Why it matters

Before this sprint, `object-store` was still present in the runtime contract as if it were just another equally valid primary backend mode.

That kept the architecture mentally split between:

- PostgreSQL as the cloud target
- object-store as an implicit peer

After this sprint, the code reflects the intended reality more honestly:

- PostgreSQL is the default and intended steady state
- object-store exists only for rollback or migration windows

This is an architectural demotion, not just a documentation note.

## Validation

- `node --check server/env.mjs`
- `node --check server/data/repository.mjs`
- `node --check server/data/compatibility-repository.mjs`
- `node --check scripts/staging-cutover-checklist.mjs`
- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`

## Still transitional

Even after this sprint, the following still exist as compatibility infrastructure:

- `server/services/storage-admin-service.mjs`
- sidecar/index diagnostics and rebuild tooling
- `object-store` runtime path during explicit compatibility mode

## Next

The next sprint should focus on the final architectural cleanup of the legacy lane:

1. rename/document compatibility services as legacy/rollback-only
2. reduce admin/storage logic that still assumes snapshot semantics
3. define the point at which `object-store` can be retired entirely
