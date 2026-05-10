# Sprint 40: Ad Server Domain Inventory

## Purpose

Document the minimum `Ad Server` backend domain that must be ported into the new `apps/api` so the restored `apps/web` frontend can run on the new platform without compatibility patching.

This inventory is intentionally scoped to the first migration tranche:

- `campaigns`
- `tags`
- `reporting`

These three domains unlock the current broken staging paths and establish the baseline for the rest of the ad-serving platform.

## Current mismatch

### Frontend

`apps/web` now serves the modern Ad Server frontend.

It relies on:

- campaign management
- tag management
- reporting dashboards
- workspace switching
- creative library integration

### Backend

The new `apps/api` currently only exposes:

- auth
- workspaces
- projects
- assets
- health

That means the frontend is correct for the product, but the backend does not yet implement the required product domain.

## Legacy source of truth

The authoritative legacy implementation lives in:

- `/Users/enzocienfuegos/Documents/mandarionkas-refactor/apps/api/src/modules/campaigns/campaign-routes.mjs`
- `/Users/enzocienfuegos/Documents/mandarionkas-refactor/apps/api/src/modules/tags/tag-routes.mjs`
- `/Users/enzocienfuegos/Documents/mandarionkas-refactor/apps/api/src/modules/tags/tag-reporting-routes.mjs`
- `/Users/enzocienfuegos/Documents/mandarionkas-refactor/apps/api/src/modules/tags/health-routes.mjs`
- `/Users/enzocienfuegos/Documents/mandarionkas-refactor/apps/api/src/modules/reporting/routes.mjs`

## Domain 1: Campaigns

### Legacy routes

- `GET /v1/campaigns`
- `GET /v1/campaigns/:id/tags-export`
- `GET /v1/campaigns/:id/events-export`
- `POST /v1/campaigns`
- `GET /v1/campaigns/:id`
- `PUT /v1/campaigns/:id`
- `DELETE /v1/campaigns/:id`

### Dependencies observed in legacy implementation

- `@smx/db/campaigns`
  - `listCampaigns`
  - `listCampaignsForUser`
  - `getCampaign`
  - `createCampaign`
  - `updateCampaign`
  - `deleteCampaign`
  - advertiser helpers
- `workspace_members`
  membership validation
- `campaigns`
- `ad_tags`
- `tag_format_configs`
- `tag_bindings`
- `creative_versions`
- `creative_size_variants`
- `tag_creatives`
- `workspaces`
- DSP delivery helpers from `@smx/contracts/dsp-macros`
- static VAST URL helpers from the VAST module

### Functional responsibility

This module does more than CRUD. It also:

- exports campaign-tag delivery snippets
- exports campaign events
- resolves cross-workspace membership
- builds delivery URLs for display, native, VAST, and tracker flows

### Migration note

This is the correct first domain to port because:

- `apps/web/src/campaigns/*` depends on it directly
- campaign lists and editors are core navigation paths
- tag delivery export logic establishes dependencies we must understand before moving `tags`

## Domain 2: Tags

### Legacy routes

#### Tag CRUD and delivery routes

- `GET /v1/tags`
- `POST /v1/tags`
- `GET /v1/tags/:id/export`
- `GET /v1/tags/:id`
- `GET /v1/tags/:id/delivery-diagnostics`
- `GET /v1/tags/:id/bindings`
- `PATCH /v1/tags/:id/bindings/:bindingId`
- `PUT /v1/tags/:id`
- `DELETE /v1/tags/:id`

#### Tag reporting routes

- `GET /v1/tags/top`
- `GET /v1/tags/:id/stats`
- `GET /v1/tags/:id/summary`

#### Tag health routes

- `GET /v1/tags/health`
- `GET /v1/tags/health/summary`
- `GET /v1/tags/:id/health`
- `POST /v1/tags/:id/health/check`

### Dependencies observed in legacy implementation

- `ad_tags`
- `campaigns`
- `tag_format_configs`
- `tag_bindings`
- `creative_versions`
- `creative_size_variants`
- `tag_creatives`
- `workspace_members`
- `workspaces`
- delivery snippet builders
- static VAST profile resolution
- tag health audit/reporting data

### Functional responsibility

The tags domain owns:

- tag lifecycle
- delivery exports
- delivery diagnostics
- creative bindings
- tracker/display/VAST delivery variants
- tag-level reporting summaries
- health checks

### Migration note

`tags` should be ported immediately after `campaigns` because:

- the campaign export paths depend on tag delivery behavior
- much of the ad-serving UX assumes tags are first-class entities

## Domain 3: Reporting

### Legacy routes

- `GET /v1/reporting/workspace`
- `GET /v1/reporting/workspace/campaign-breakdown`
- `GET /v1/reporting/workspace/tag-breakdown`
- `GET /v1/reporting/workspace/site-breakdown`
- `GET /v1/reporting/workspace/country-breakdown`
- `GET /v1/reporting/workspace/region-breakdown`
- `GET /v1/reporting/workspace/city-breakdown`
- `GET /v1/reporting/workspace/tracker-breakdown`
- `GET /v1/reporting/workspace/engagement-breakdown`
- `GET /v1/reporting/workspace/identity-breakdown`
- `GET /v1/reporting/workspace/identity-export`
- `GET /v1/reporting/workspace/identity-audience-export`
- `GET /v1/reporting/workspace/saved-audiences`
- `POST /v1/reporting/workspace/saved-audiences`
- `DELETE /v1/reporting/workspace/saved-audiences/:id`
- `GET /v1/reporting/workspace/identity-segment-presets`
- `GET /v1/reporting/workspace/identity-frequency-buckets`
- `GET /v1/reporting/workspace/identity-key-breakdown`
- `GET /v1/reporting/workspace/identity-attribution-windows`
- `GET /v1/reporting/workspace/context-snapshot`
- `GET /v1/reporting/workspace/creative-breakdown`
- `GET /v1/reporting/workspace/variant-breakdown`
- `GET /v1/reporting/campaigns/:id`
- `GET /v1/reporting/tags/:id`

### Dependencies observed in frontend

The frontend uses reporting in:

- `apps/web/src/overview/AdOpsOverview.tsx`
- `apps/web/src/analytics/AnalyticsDashboard.tsx`
- `apps/web/src/reporting/*`

It expects:

- workspace-level KPIs
- breakdowns by campaign, tag, creative, variant, site, country, region, city
- tracker and engagement summaries
- identity analytics
- audience export and saved audience operations
- context snapshots

### Migration note

This is the third domain to port because:

- overview and reporting are top-level product surfaces
- the ad server looks “broken” to operators without these routes even if campaigns and tags exist

## Proposed module structure in the new backend

Recommended new structure inside `apps/api/src/modules/adserver`:

- `campaigns/routes.mjs`
- `campaigns/service.mjs`
- `tags/routes.mjs`
- `tags/service.mjs`
- `tags/reporting-routes.mjs`
- `tags/health-routes.mjs`
- `reporting/routes.mjs`
- `reporting/service.mjs`

This can start as route + service files and evolve later as repositories are extracted.

## Proposed migration order

### Slice 1: Campaign list/editor viability

Port:

- `GET /v1/campaigns`
- `GET /v1/campaigns/:id`
- `POST /v1/campaigns`
- `PUT /v1/campaigns/:id`
- `DELETE /v1/campaigns/:id`

Frontend unlocked:

- campaign list
- campaign editor

### Slice 2: Tag list and binding viability

Port:

- `GET /v1/tags`
- `POST /v1/tags`
- `GET /v1/tags/:id`
- `PUT /v1/tags/:id`
- `DELETE /v1/tags/:id`
- `GET /v1/tags/:id/bindings`
- `PATCH /v1/tags/:id/bindings/:bindingId`

Frontend unlocked:

- tag list
- tag builder
- creative-to-tag workflows

### Slice 3: Workspace overview viability

Port:

- `GET /v1/reporting/workspace`
- `GET /v1/reporting/workspace/campaign-breakdown`
- `GET /v1/reporting/workspace/tag-breakdown`
- `GET /v1/reporting/workspace/creative-breakdown`
- `GET /v1/reporting/workspace/identity-segment-presets`

Frontend unlocked:

- ad ops overview
- partial reporting dashboards

### Slice 4: Operator exports and health

Port:

- `GET /v1/campaigns/:id/tags-export`
- `GET /v1/campaigns/:id/events-export`
- `GET /v1/tags/:id/export`
- `GET /v1/tags/:id/delivery-diagnostics`
- health routes
- tag summary routes

Frontend unlocked:

- operational workflows
- delivery diagnostics
- QA tools

## Immediate implementation target

The first concrete code migration should be:

1. create `apps/api/src/modules/adserver/campaigns`
2. port the campaign route surface
3. register those routes in `apps/api/src/app.mjs`
4. validate `apps/web/src/campaigns/CampaignList.tsx`
5. validate `apps/web/src/campaigns/CampaignEditor.tsx`

Only after campaigns are stable should we move into tags and reporting.

## Success criteria for this tranche

We can call the first tranche successful when:

- `app-staging` no longer 404s on campaign and tag bootstrap paths
- campaign list works on the new backend
- tag list works on the new backend
- overview loads core reporting cards
- no legacy backend is required for those product flows

