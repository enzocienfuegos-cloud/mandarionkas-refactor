# Sprint 20 - Production Readiness Gaps

## Goal

Make the remaining path from staging confidence to production cutover explicit: what is automated, what is still manual, and what is currently blocking vs acceptable follow-up.

## Completed in this sprint

- added [scripts/production-readiness-report.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/production-readiness-report.mjs)
- added `npm run production:readiness:report`
- extended env guidance in [.env.example](/Users/enzocienfuegos/Documents/New%20project/.env.example) for smoke/readiness inputs

## What the readiness report covers

- production/staging configuration health:
  - `PLATFORM_REPOSITORY_DRIVER`
  - `PLATFORM_POSTGRES_URL`
  - `PLATFORM_POSTGRES_SCHEMA`
  - `PLATFORM_ALLOWED_ORIGIN`
  - R2 credentials and public base
  - smoke base URL and smoke credentials
- automated coverage that already exists in the repo:
  - preflight
  - migrations
  - repository readiness
  - post-deploy checks
  - domain acceptance matrix
  - staging smoke
  - snapshot compare
- known gaps still outside safe automation

## Current gap classification

### Acceptable warnings before a careful first production cutover

- `upload-completion`
  - warning only while `STAGING_ACCEPTANCE_INCLUDE_UPLOAD_COMPLETION` is disabled
  - once enabled, staging acceptance can exercise a real binary round-trip before `/assets/complete-upload`
- `client-membership-mutations`
  - excluded from automation to avoid polluting real tenants during repeated cutover checks
- `rollback-validation`
  - rollback is documented, but there is not yet a dedicated automated rollback rehearsal command

### Hard blockers

- missing or invalid PostgreSQL production config
- missing or invalid R2 binary-storage config
- missing smoke base URL or smoke credentials for post-deploy verification
- repository driver not set to `postgres` in the intended cutover env

## Recommended production gate

1. `npm run production:readiness:report`
2. `npm run db:postgres:preflight`
3. `npm run db:postgres:migrate`
4. `npm run staging:post-deploy:check`
5. `npm run staging:acceptance:matrix`
6. `npm run staging:platform:smoke`
7. `npm run platform:snapshot:compare <before.json> <after.json>`
8. review only the remaining warning-class gaps and decide if they are acceptable for the specific cutover window

## Definition of done

- the repo can now distinguish blockers from follow-up gaps
- production readiness is no longer implied only by passing smoke tests
- operators have a single report to review before approving a real cutover
