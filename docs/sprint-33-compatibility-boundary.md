# Sprint 33 - Compatibility Boundary

This sprint isolates the remaining snapshot/sidecar compatibility behavior from the main repository contract.

## What changed

- added `server/data/compatibility-repository.mjs`
- moved snapshot-style compatibility access behind that boundary:
  - `readCompatibilitySnapshot()`
  - `writeCompatibilitySnapshot()`
  - sidecar listing helpers
  - sidecar write/delete helpers used by admin compatibility flows
- `server/services/storage-admin-service.mjs` now depends on `compatibility-repository` instead of the main repository contract
- `server/data/repository.mjs` no longer exposes snapshot/sidecar compatibility methods as part of the primary repository API
- `scripts/postgres-smoke.mjs` now uses the compatibility boundary explicitly when it needs snapshot-style round-trip validation

## Why it matters

Before this sprint, the main repository entrypoint still mixed together two very different concerns:

- domain persistence for the actual product
- compatibility persistence for snapshot/sidecar tooling

That meant the central repository contract still carried legacy concepts even after most runtime flows had moved away from them.

After this sprint:

- the primary repository contract is more clearly domain-oriented
- compatibility behavior is explicit and isolated
- admin/storage tooling is clearly marked as transitional infrastructure, not core product architecture

## Still transitional

This does not remove compatibility yet.

The remaining major transitional pieces are:

- `server/services/storage-admin-service.mjs`
- sidecar rebuild/diagnostic logic
- `object-store` as rollback/migration compatibility

Those are now more clearly quarantined, but still exist.

## Validation

- `node --check server/data/compatibility-repository.mjs`
- `node --check server/services/storage-admin-service.mjs`
- `node --check scripts/postgres-smoke.mjs`
- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`

## Next

The next sprint should focus on the remaining architectural decision:

1. downgrade `object-store` from a first-class driver in the product design
2. make it explicitly migration/rollback-only
3. tighten docs and tooling around PostgreSQL + object storage as the intended steady state
