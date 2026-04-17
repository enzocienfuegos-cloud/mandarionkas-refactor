# Sprint 6 - Residual Monolith Closure

## Goal

Finish extracting the remaining backend responsibilities from `server/store.mjs` so the file becomes a compatibility facade instead of a live monolith.

## Completed in this sprint

- extracted workspace/client mutations to `server/services/client-service.mjs`
- extracted storage diagnostics and rebuild flows to `server/services/storage-admin-service.mjs`
- reduced `server/store.mjs` to a thin export layer over domain services
- preserved the route contract in `server/server.mjs`

## Why this matters

This is the point where the backend structure becomes migration-friendly:

- each domain can move to a new repository adapter independently
- testing can be added per service instead of around one giant module
- backend ownership is clearer for future contributors

## Current backend shape

- `server/services/auth-service.mjs`
- `server/services/project-service.mjs`
- `server/services/asset-service.mjs`
- `server/services/document-service.mjs`
- `server/services/client-service.mjs`
- `server/services/storage-admin-service.mjs`
- `server/services/shared.mjs`
- `server/data/object-store-repository.mjs`
- `server/store.mjs` as compatibility facade

## Remaining gaps

- repository contract tests still do not exist
- the active persistence adapter is still object-storage-backed
- no PostgreSQL implementation has been introduced yet

## Definition of done for Sprint 6

- `server/store.mjs` no longer owns backend business logic
- backend domains are split into service modules
- the next major step can focus on persistence migration instead of structural cleanup
