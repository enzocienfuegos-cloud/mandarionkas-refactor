# Sprint 27 - Staging Env Readiness

## Goal

Make `.env.staging` preparation less error-prone before a real cutover window.

## Completed in this sprint

- added [scripts/check-staging-env-readiness.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/check-staging-env-readiness.mjs)
- added `npm run staging:env:check`
- added a guided [.env.staging.template](/Users/enzocienfuegos/Documents/New%20project/.env.staging.template)

## What the env check validates

- required staging URLs are set and not placeholder values
- PostgreSQL URL/schema are present and syntactically valid
- R2 credentials and public base are present and not placeholder values
- smoke credentials exist
- expected driver assertions are sane
- tenant mutation rehearsal is only considered enabled when a real smoke prefix exists

## Definition of done

- the repo can fail fast on placeholder-heavy `.env.staging` files
- operators have a dedicated template for real staging values
- the next step toward an actual cutover is environment preparation, not more infrastructure work
