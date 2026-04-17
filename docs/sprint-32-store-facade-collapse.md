# Sprint 32 - Store Facade Collapse

This sprint removes a leftover compatibility layer that no longer provided meaningful architectural value.

## What changed

- `server/server.mjs` now imports directly from the backend service modules:
  - `auth-service.mjs`
  - `project-service.mjs`
  - `asset-service.mjs`
  - `document-service.mjs`
  - `client-service.mjs`
  - `storage-admin-service.mjs`
  - `audit-service.mjs`
  - `shared.mjs`
- `server/store.mjs` was removed.

## Why it matters

`server/store.mjs` started as a safe compatibility facade while backend logic was being split out of a central file.

At this point that split is already complete enough that keeping the facade just:

- hid the real service boundaries
- preserved an outdated mental model
- added an unnecessary extra layer in the server entrypoint

Removing it makes the backend topology more honest:

- `server/server.mjs` talks directly to service modules
- services talk to repository/domain methods
- repository chooses the active persistence adapter

That is a more explicit cloud-oriented structure than keeping a central "store" abstraction around after the domain split already happened.

## Still transitional

This sprint does **not** remove all legacy yet.

The remaining major transitional surface is:

- `storage-admin-service.mjs`
- repository compatibility helpers for sidecars / diagnostics
- `object-store` as rollback/migration compatibility

## Validation

- `node --check server/server.mjs`
- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`

## Next

The next sprint should focus on narrowing the remaining compatibility/admin zone:

1. make storage admin explicitly compatibility-scoped
2. isolate sidecar/index rebuild logic from the main repository contract
3. prepare the path to demote or retire `object-store` from the primary architecture
