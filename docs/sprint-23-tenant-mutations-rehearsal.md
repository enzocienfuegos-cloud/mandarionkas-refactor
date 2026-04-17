# Sprint 23 - Tenant Mutations Rehearsal

## Goal

Cover workspace/brand/invite mutations without making unsafe assumptions about production-like tenants.

## Completed in this sprint

- added [scripts/staging-tenant-mutations-rehearsal.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/staging-tenant-mutations-rehearsal.mjs)
- added `npm run staging:tenant-mutations:rehearsal`
- added explicit safety gates:
  - `STAGING_TENANT_MUTATION_REHEARSAL_ALLOW`
  - `STAGING_TENANT_MUTATION_REHEARSAL_PREFIX`
  - `STAGING_TENANT_MUTATION_REHEARSAL_INVITE_DOMAIN`
- updated the production readiness report so tenant mutation coverage can move from warning to ready once a smoke-only tenant configuration exists

## What the rehearsal checks

- `POST /auth/login`
- `POST /clients`
- `POST /clients/active`
- `POST /clients/:id/brands`
- `POST /clients/:id/invites`
- `GET /clients`
- `POST /auth/logout`

## Safety model

- the runner is disabled by default
- it requires an explicit allow flag
- it requires a dedicated smoke prefix for created workspaces
- it uses a synthetic invite email domain by default
- it intentionally leaves rehearsal records behind, so it should only run in a smoke-only tenant strategy

## Definition of done

- tenant mutations no longer depend on ad hoc manual clicking
- the rehearsal is safe-by-default because it refuses to run without explicit smoke-only configuration
- production readiness can treat tenant mutation coverage as conditionally ready instead of permanently unowned
