# Sprint 37 - Compatibility Route Prefix

This sprint makes the remaining legacy HTTP surface explicit by moving compatibility tooling behind a dedicated route prefix.

## What changed

- added explicit compatibility-prefixed admin routes:
  - `GET /admin/compatibility/storage/diagnostics`
  - `POST /admin/compatibility/storage/rebuild`
  - `GET /admin/compatibility/assets/housekeeping`
  - `POST /admin/compatibility/maintenance/cleanup-assets`
- legacy route aliases remain available for now:
  - `GET /admin/storage/diagnostics`
  - `POST /admin/storage/rebuild`
  - `GET /admin/assets/housekeeping`
  - `POST /admin/maintenance/cleanup-assets`
- compatibility endpoints now return headers that mark them as compatibility routes and advertise the canonical replacement path
- operational scripts were updated to use the explicit compatibility-prefixed routes

## Why it matters

Even after isolating compatibility code internally, the HTTP surface still made legacy tooling look like first-class admin product endpoints.

This sprint fixes that by making the route naming match the architecture:

- normal product/admin APIs stay under their regular paths
- legacy/rollback/compatibility tooling moves under `/admin/compatibility/...`

That creates a safer runway for future removal because callers can migrate off the legacy aliases gradually.

## Validation

- `node --check server/server.mjs`
- `node --check scripts/run-asset-housekeeping.mjs`
- `node --check scripts/staging-rollback-rehearsal.mjs`
- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`

## Next

The next sprint should mark the old non-prefixed compatibility routes as deprecated in docs and decide on a retirement timeline for the aliases.
