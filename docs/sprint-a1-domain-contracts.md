# Sprint A1 — Domain Contracts

This sprint starts the final decoupling track by making backend service ownership explicit.

## Included

- added narrow repository contracts for:
  - `auth`
  - `projects`
  - `assets`
- moved:
  - `server/services/auth-service.mjs`
  - `server/services/project-service.mjs`
  - `server/services/asset-service.mjs`
  so they depend on their domain contracts instead of importing the full repository surface
- documented the contract boundary in:
  - `server/contracts/README.md`

## Why this matters

Before this sprint, each service imported a broad repository module and could easily start depending on persistence methods from unrelated domains.

After this sprint:

- service ownership is clearer
- imports communicate domain boundaries directly
- the next split of `postgres-repository.mjs` can happen domain by domain without rewriting service call sites again

## Validation

- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`
