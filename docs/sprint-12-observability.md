# Sprint 12 - Post-Cutover Observability

## Goal

Give staging and the first PostgreSQL cutover enough observability to diagnose failures quickly without adding a full telemetry stack yet.

## Completed in this sprint

- added structured server logging in [server/observability.mjs](/Users/enzocienfuegos/Documents/New%20project/server/observability.mjs)
- added per-request `X-Request-Id` headers from [server/server.mjs](/Users/enzocienfuegos/Documents/New%20project/server/server.mjs)
- added in-memory request metrics grouped by route
- added `GET /observability` for a JSON snapshot of:
  - request totals
  - 4xx/5xx totals
  - per-route request counts
  - per-route average duration
  - last status and last request time
- added `PLATFORM_OBSERVABILITY_ENABLED`

## Why this matters

During the first PostgreSQL switch, the main questions are:

- are requests reaching the API?
- which route is failing?
- are failures auth-related, repository-related or asset-related?
- do we have a request id to correlate logs and user reports?

This sprint answers those with the minimum amount of infrastructure.

## Recommended post-cutover checks

1. hit `/health`
2. hit `/readyz`
3. hit `/version`
4. hit `/observability`
5. run `npm run staging:platform:smoke`
6. inspect logs for `http.request` and `http.error`

## Definition of done

- each response has a request id
- the API emits structured request logs
- staging has a basic route-level observability view after cutover
