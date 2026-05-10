# Sprint 17 - Operational Cutover Pack

## Goal

Complete the staging PostgreSQL cutover path with a small operational pack: post-deploy verification, explicit rollback steps and driver assertions in smoke automation.

## Completed in this sprint

- extended [scripts/staging-platform-smoke.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/staging-platform-smoke.mjs) to check:
  - `GET /version`
  - `GET /observability`
  - expected repository driver on `readyz`, `version` and `observability`
- added [scripts/staging-post-deploy-check.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/staging-post-deploy-check.mjs)
- added `npm run staging:post-deploy:check`
- added `STAGING_EXPECTED_REPOSITORY_DRIVER` and `SMOKE_EXPECTED_REPOSITORY_DRIVER` to env examples

## Recommended cutover order

1. run `npm run db:postgres:preflight`
2. run `npm run db:postgres:migrate`
3. run `env PLATFORM_REPOSITORY_DRIVER=postgres npm run db:postgres:ready`
4. deploy/start the API with PostgreSQL enabled
5. run `npm run staging:post-deploy:check`
6. run `npm run staging:platform:smoke`
7. inspect `GET /observability` and `GET /admin/audit-events` if anything looks off

## Rollback rule

If post-deploy checks or smoke fail after switching to PostgreSQL:

1. switch only `PLATFORM_REPOSITORY_DRIVER` back to `object-store`
2. redeploy the API with the same env otherwise unchanged
3. rerun `npm run staging:post-deploy:check`
4. inspect `/observability` and recent audit events before attempting the next cutover

## Definition of done

- staging has a lightweight post-deploy check
- smoke validation asserts the intended repository driver
- rollback is documented as a minimal config flip instead of a multi-variable scramble
