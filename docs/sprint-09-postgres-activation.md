# Sprint 9 - PostgreSQL Activation

## Goal

Turn the PostgreSQL work into an operational flow the team can actually run during deployment.

## Completed in this sprint

- added ordered SQL migrations under `server/data/postgres-migrations/`
- added `scripts/run-postgres-migrations.mjs`
- added `scripts/check-postgres-readiness.mjs`
- added package scripts:
  - `npm run db:postgres:migrate`
  - `npm run db:postgres:ready`
  - `npm run db:postgres:smoke`
- added repository readiness support and exposed it through:
  - `GET /readyz`
  - `GET /version`
- added `pg` to `package.json` so the runtime can connect directly once dependencies are installed

## Why this matters

Before this sprint, enabling PostgreSQL still required manual DDL handling and there was no first-class readiness signal for deployments.

After this sprint, the repo has:

- a migration path
- a readiness check
- a local smoke path that does not require a managed database
- an activation sequence
- a server endpoint that can tell orchestration whether the repository layer is actually reachable

## Activation sequence

1. Set `PLATFORM_POSTGRES_URL`
2. Set `PLATFORM_POSTGRES_SCHEMA` if you do not want `public`
3. Run `npm run db:postgres:migrate`
4. Run `npm run db:postgres:ready`
5. Start the API with `PLATFORM_REPOSITORY_DRIVER=postgres`

## Remaining gaps

- dependencies still need to be installed in the environment before the `pg` path can execute
- migration coverage is only at the compatibility-schema level
- the repository still uses snapshot persistence and should continue evolving toward explicit domain writes

## Definition of done for Sprint 9

- the repo includes executable PostgreSQL migration tooling
- readiness can be checked from both CLI and HTTP
- the production activation path for PostgreSQL is explicit
