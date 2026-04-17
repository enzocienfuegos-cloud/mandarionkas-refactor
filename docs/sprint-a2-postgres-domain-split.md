# Sprint A2 — Postgres Domain Split

This sprint turns the domain contracts from thin indirection into real PostgreSQL domain repositories.

## Included

- added domain repositories:
  - `server/data/postgres-auth-repository.mjs`
  - `server/data/postgres-client-repository.mjs`
  - `server/data/postgres-project-repository.mjs`
  - `server/data/postgres-asset-repository.mjs`
- added shared PostgreSQL mapping helpers in:
  - `server/data/postgres-support.mjs`
- rewired:
  - `server/data/repository.mjs`
  - `server/contracts/auth-repository.mjs`
  - `server/contracts/project-repository.mjs`
  - `server/contracts/asset-repository.mjs`
  so the active path now goes through domain-specific PostgreSQL modules

## Result

The backend still keeps `server/data/postgres-repository.mjs` for snapshot-oriented tooling, but the active domain write/read path for:

- auth
- clients
- projects
- assets

now lives in narrower modules with clearer ownership.

## Validation

- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`
