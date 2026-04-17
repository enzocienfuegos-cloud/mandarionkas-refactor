# Sprint 7 - Repository Contract

## Goal

Introduce a single persistence entrypoint so backend services stop depending directly on one concrete storage adapter.

## Completed in this sprint

- added `server/data/repository.mjs` as the backend persistence contract entrypoint
- switched backend services to import persistence operations from the repository contract instead of from the object-store adapter directly
- added `server/data/postgres-repository.mjs` as an initial PostgreSQL adapter placeholder
- added `PLATFORM_REPOSITORY_DRIVER` environment selection with:
  - `object-store`
  - `postgres`

## Why this matters

Before this sprint, even after service extraction, every domain service was still tied directly to the object-storage implementation. That meant introducing PostgreSQL would still require touching multiple services at once.

After this sprint, the services depend on one repository module. The persistence driver can now change behind that boundary.

## Current state at the end of Sprint 7

- `object-store` remained the only working adapter at the close of this sprint
- `postgres` was still a placeholder at this point
- service modules were prepared for adapter substitution

## Remaining gaps

- no real PostgreSQL reads/writes exist yet
- repository interface tests still do not exist
- the current contract mirrors the old object-store shape and still needs to evolve toward more explicit domain operations

## Definition of done for Sprint 7

- services no longer import the concrete object-store adapter directly
- repository driver selection exists
- backend is structurally ready for incremental PostgreSQL implementation
