# Sprint 41: Ad Server Port vs Rewrite Assessment

## Decision

Do **not** rewrite the Ad Server from scratch.

Porting is sufficient, but only if each Ad Server bounded context is migrated as a **complete vertical slice**:

1. schema migrations
2. `packages/db` query module
3. API route module
4. demo seed / smoke validation

Porting route handlers alone is not enough because the current new platform schema does not include the Ad Server domain tables.

## Why a rewrite is the wrong move

- Ad serving, campaign management, analytics, and tag operations already exist as working legacy domain logic.
- Rebuilding those domains from zero would re-open correctness risk in:
  - campaign lifecycle behavior
  - rollups / reporting math
  - tag delivery semantics
  - future VAST, pacing, discrepancies, and webhook integrations
- The legacy code is already modular enough to migrate by domain.

## Why porting is enough

The legacy Ad Server is already organized into domain-oriented modules:

- `campaigns`
- `tags`
- `reporting`
- `pacing`
- `discrepancies`
- `api-keys`
- `webhooks`
- `tracking`

That makes it feasible to move the backend into the new modular monolith without preserving the old deployment topology.

## Architectural rule for the migration

Every product domain must be migrated as a release unit:

- migrations
- query layer
- API routes
- frontend contract validation

No endpoint aliases. No frontend-only compatibility shims for missing backend domains.

## First vertical slice

The first concrete slice is `campaigns`:

- schema foundation for advertisers / campaigns / tags / stats
- `packages/db/src/campaigns.mjs`
- `apps/api/src/modules/adserver/campaigns/routes.mjs`
- seeded demo advertiser, campaign, and stats

This proves the migration path and establishes the base for:

- `tags`
- `reporting`

## Recommended next slices

1. `tags`
2. `reporting`
3. `pacing`
4. `discrepancies`
5. `api-keys`
6. `webhooks`

## Success criteria

The migration is considered healthy when:

- `app-staging` uses only backend routes implemented in the new `apps/api`
- role-based access still flows through the unified identity/session model
- product entitlements are enforced by the new platform model rather than legacy routing assumptions
