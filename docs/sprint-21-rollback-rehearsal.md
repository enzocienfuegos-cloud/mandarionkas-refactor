# Sprint 21 - Rollback Rehearsal

## Goal

Turn rollback from a documented idea into a repeatable live validation path for `postgres -> object-store`.

## Completed in this sprint

- added [scripts/staging-rollback-rehearsal.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/staging-rollback-rehearsal.mjs)
- added `npm run staging:rollback:rehearsal`
- added `STAGING_ROLLBACK_EXPECTED_DRIVER=object-store` to env examples
- updated the production readiness report so rollback validation is no longer treated as an open gap

## What the rollback rehearsal checks

- `GET /health`
- `GET /readyz`
- `GET /version`
- `GET /observability`
- `POST /auth/login`
- `GET /auth/session`
- `GET /clients`
- `GET /projects`
- `GET /assets`
- `GET /admin/storage/diagnostics`
- `POST /auth/logout`

All driver-aware endpoints must report `object-store` during the rehearsal.

## Recommended rollback rehearsal order

1. switch `PLATFORM_REPOSITORY_DRIVER=object-store`
2. set `PLATFORM_OBJECT_STORE_COMPATIBILITY_MODE=true`
3. redeploy/restart the API with the rest of the env unchanged
4. run `npm run staging:rollback:rehearsal`
5. inspect `/observability` and storage diagnostics if anything fails
6. only after a clean rehearsal, consider the rollback path production-credible

## Definition of done

- rollback has a dedicated live verification command
- fallback no longer depends only on manual clicking and intuition
- production readiness can treat rollback as covered instead of an unowned warning
