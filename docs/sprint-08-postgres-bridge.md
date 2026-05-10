# Sprint 8 - PostgreSQL Bridge

## Goal

Move the repository work from "driver selection exists" to "a PostgreSQL adapter can now persist the main backend snapshot through SQL tables."

## Completed in this sprint

- extracted the shared DB seed/normalization logic to `server/data/db-shape.mjs`
- added `server/data/postgres-client.mjs` as the PostgreSQL execution boundary
- expanded `server/data/postgres-repository.mjs` from a stub into a compatibility bridge that:
  - reads users, sessions, clients, projects, project states, versions, drafts and assets from PostgreSQL tables
  - writes the same backend snapshot inside one SQL transaction
  - auto-seeds the compatibility schema when the tables are empty
- added `server/data/postgres-schema.sql` with the initial table layout
- added PostgreSQL env configuration to `.env.example`

The schema file targets `public` by default. If deployment uses a custom schema, apply the same DDL there before switching `PLATFORM_POSTGRES_SCHEMA`.

## Why this matters

Before this sprint, selecting `PLATFORM_REPOSITORY_DRIVER=postgres` only failed fast.

After this sprint, the codebase has a real SQL persistence path and a clear integration seam for the future database driver. That means the next work can focus on:

- wiring a real migration runner
- installing `pg` or binding a managed runtime executor
- optimizing the repository away from full snapshot writes into explicit domain operations

Sprint 9 builds directly on top of this bridge by adding the migration/activation flow.

## Current state

- `object-store` remains the default driver
- PostgreSQL support now has:
  - a concrete schema file
  - a concrete adapter
  - a concrete execution boundary
- the adapter is intentionally a compatibility bridge, not the final optimized repository design

## Remaining gaps

- the project still does not ship the `pg` package, so PostgreSQL runtime activation needs either:
  - `pg` installed
  - or an injected executor
- writes are still snapshot-based, so this is a migration bridge, not the end-state architecture
- migrations, repository tests and rollout tooling still need to be added

## Definition of done for Sprint 8

- the repo contains a real PostgreSQL adapter instead of a placeholder
- the adapter can read/write the current backend snapshot model through SQL tables
- the integration boundary for managed/cloud PostgreSQL is explicit
