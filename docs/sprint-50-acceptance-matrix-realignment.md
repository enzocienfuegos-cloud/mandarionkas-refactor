# Sprint 50 - Acceptance Matrix Realignment

## Summary

Staging infrastructure and the S50 portal cutover are healthy, but
[scripts/staging-acceptance-matrix.mjs](/Users/enzocienfuegos/Documents/MandaRion/scripts/staging-acceptance-matrix.mjs)
is no longer a valid source of truth for go/no-go decisions.

This is not a staging outage. It is a contract drift problem:

- the deployed API responds correctly on `/healthz`, `/readyz`, `/version`, and `/v1/*`
- the acceptance matrix still targets a pre-unification route surface such as `/health`, `/auth/login`, `/clients`, `/projects`, `/assets`, and `/admin/audit-events`
- those routes now return `404` because the platform has moved to a different HTTP contract

The correct engineering response is to refactor the matrix to the current product/API shape, not to keep layering compatibility shims or quick patches around old endpoints.

## Current validated staging state

The following staging checks passed against the current deployment:

- `GET /healthz`
- `GET /readyz`
- `GET /version`
- portal cutover validation in
  [scripts/validate-portal-cutover.mjs](/Users/enzocienfuegos/Documents/MandaRion/scripts/validate-portal-cutover.mjs)
- post-deploy smoke in
  [scripts/staging-post-deploy-check.mjs](/Users/enzocienfuegos/Documents/MandaRion/scripts/staging-post-deploy-check.mjs)

Operationally, staging is in a good state:

- `api-staging.duskplatform.co` is healthy and ready
- `portal-staging.duskplatform.co` is reachable
- `app-staging.duskplatform.co` is reachable
- `studio-staging.duskplatform.co` is reachable
- `portal`, `web`, and `studio` are now split into separate staging apps
- CORS is correctly aligned to the portal origin

## What is failing

The acceptance matrix currently fails with `404` responses across multiple domains:

- `platform`
  - `GET /health`
- `auth_session`
  - `POST /auth/login`
  - `GET /auth/session`
- `clients_workspaces`
  - `GET /clients`
  - `POST /clients/active`
- `projects_versions`
  - `/projects/*`
- `drafts_documents`
  - `/documents/*`
- `assets_uploads`
  - `/assets/*`
- `admin_observability_audit`
  - `/admin/audit-events`

These failures are expected under the current API contract because the matrix still assumes a legacy route surface.

## Root cause

Sprint 39 through Sprint 50 changed the platform in two important ways:

1. route and product unification
- the platform now exposes a product-oriented API under `/v1/*`
- auth/session/workspaces/tags/creatives/audit/tracking/pixels were consolidated under the new surface

2. shell split
- `apps/portal` became the canonical identity and launcher shell
- `apps/web` became the Ad Server product app
- `apps/studio` became the Studio product app

The acceptance matrix was never realigned to those architectural changes.

So the failure is not "the acceptance matrix found a broken environment".
The failure is "the acceptance matrix is testing the wrong application contract".

## Why patching would be the wrong move

Adding compatibility endpoints purely to satisfy the old matrix would be the wrong tradeoff.

It would:

- re-couple the new platform to the old route surface
- create false pressure to keep deprecated endpoints alive
- increase maintenance cost in auth, projects, assets, and admin domains
- blur the real product boundary between `portal`, `web`, `studio`, and `api`

That would be a regression in architecture quality.

## Recommended refactor

Replace the current monolithic acceptance matrix with a contract-aligned matrix that validates the actual S50 platform.

### 1. Keep post-deploy smoke small and operational

Continue using:

- [scripts/staging-post-deploy-check.mjs](/Users/enzocienfuegos/Documents/MandaRion/scripts/staging-post-deploy-check.mjs)
- [scripts/validate-portal-cutover.mjs](/Users/enzocienfuegos/Documents/MandaRion/scripts/validate-portal-cutover.mjs)

These should stay focused on:

- reachability
- readiness
- version contract
- portal/API CORS and shell cutover

### 2. Replace the legacy acceptance matrix with domain contracts that match `/v1/*`

Recommended new domains:

- `platform_runtime`
  - `GET /healthz`
  - `GET /readyz`
  - `GET /version`

- `auth_portal`
  - `POST /v1/auth/login`
  - `GET /v1/auth/session`
  - `POST /v1/auth/logout`

- `workspace_context`
  - `GET /v1/workspaces`
  - active workspace/session coherence

- `adserver_catalog`
  - `GET /v1/creatives`
  - `GET /v1/tags`
  - optionally `GET /v1/campaigns`

- `audit_access`
  - `GET /v1/audit`
  - validate permission-gated behavior

- `tracking_reporting`
  - `GET /v1/tracking/tags/:tagId/summary`
  - optionally reporting endpoints that are part of the current production path

- `studio_shell`
  - portal-to-studio navigation reachability
  - authenticated session reuse if credentials exist

### 3. Split "authenticated product acceptance" from "cutover acceptance"

Right now the old script tries to validate:

- runtime health
- login
- project/document CRUD
- assets lifecycle
- admin endpoints

That is too much for a single source of truth during cutover.

Proposed split:

- `staging:post-deploy:check`
  - technical runtime verification

- `validate-portal-cutover`
  - shell/domain cutover verification

- `staging:acceptance:platform`
  - authenticated platform/API contract

- `staging:acceptance:studio`
  - Studio-focused acceptance

- `staging:acceptance:adserver`
  - Ad Server-focused acceptance

This is more scalable and makes failures easier to localize.

## Proposed deprecation status

[scripts/staging-acceptance-matrix.mjs](/Users/enzocienfuegos/Documents/MandaRion/scripts/staging-acceptance-matrix.mjs)
should be treated as:

- `stale`
- not a blocker for S50 staging cutover
- pending replacement, not endpoint compatibility restoration

Recommended near-term action:

1. mark the current script as legacy in docs
2. stop using its result as a staging health signal
3. schedule a replacement aligned to the current `/v1/*` contract

## Practical recommendation for the team

For the current staging cycle:

- treat staging as technically healthy
- treat portal/web/studio split as validated
- do not use the current acceptance matrix as a go/no-go gate
- use manual authenticated QA or a smoke user for product validation

For the next engineering pass:

- refactor the matrix around the current platform contract
- do not add deprecated endpoints just to satisfy the existing script

## Final position

As a senior-engineering recommendation:

- **do not patch the platform to satisfy the old acceptance matrix**
- **refactor the acceptance matrix to satisfy the new platform**

This preserves the architectural gains of the S39-S50 work instead of eroding them through compatibility creep.
