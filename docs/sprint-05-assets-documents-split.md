# Sprint 5 - Assets and Documents Split

## Goal

Continue decomposing backend domains so `server/store.mjs` stops acting like the default home for every new rule.

## Completed in this sprint

- extracted asset flows to `server/services/asset-service.mjs`
- extracted document draft/autosave flows to `server/services/document-service.mjs`
- kept route behavior unchanged by preserving `server/store.mjs` as a compatibility facade
- reduced `server/store.mjs` to:
  - workspace/client mutations
  - storage diagnostics and rebuild endpoints
  - facade exports for the already-split domains

## Why this matters

This makes the backend much easier to evolve by domain:

- asset persistence can move to a dedicated DB model without touching auth or projects
- document draft behavior can be reworked independently from uploads and workspace membership
- the remaining monolith surface is now small enough to refactor intentionally

## Current backend split

- `server/services/auth-service.mjs`
- `server/services/project-service.mjs`
- `server/services/asset-service.mjs`
- `server/services/document-service.mjs`
- `server/services/shared.mjs`
- `server/data/object-store-repository.mjs`

## Remaining gaps

- workspace/client management still lives in `server/store.mjs`
- diagnostics logic still lives in `server/store.mjs`
- repository contract tests are still missing
- persistence is still object-storage-backed

## Definition of done for Sprint 5

- assets and documents no longer depend on the monolithic service module
- backend domain boundaries are clearer
- the remaining backend monolith is limited and easier to target next
