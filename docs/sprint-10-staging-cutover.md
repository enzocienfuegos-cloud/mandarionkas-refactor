# Sprint 10 - Staging Cutover Prep

## Goal

Make the first real PostgreSQL cutover in staging repeatable and low-drama.

## Completed in this sprint

- added [.env.staging.example](/Users/enzocienfuegos/Documents/New%20project/.env.staging.example) as a cloud-first reference for the first PostgreSQL deployment
- added [scripts/check-postgres-cutover-env.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/check-postgres-cutover-env.mjs)
- added `npm run db:postgres:preflight`
- updated `.gitignore` so local environment files stay untracked while examples remain committed

## Recommended cutover sequence

1. Copy `.env.staging.example` into `.env.staging`
2. Fill in the real PostgreSQL and R2 values
3. Run `npm run db:postgres:preflight`
4. Run `npm run db:postgres:migrate`
5. Run `env PLATFORM_REPOSITORY_DRIVER=postgres npm run db:postgres:ready`
6. Start the API in staging with the same env
7. Validate `/health`, `/readyz` and `/version`
8. Execute login, project list, project save and asset upload smoke checks

## Rollback rule

If staging readiness fails after switching the driver, revert only:

- `PLATFORM_REPOSITORY_DRIVER=object-store`

Keep PostgreSQL config values in place so the next cutover attempt does not need full re-entry.

## Definition of done

- the repo contains a staging env template
- the repo can fail fast on missing cutover config
- the team has a concrete sequence for the first PostgreSQL switch in staging
