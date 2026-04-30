# Sprint 39: Unified Platform Blueprint

## Goal

Define the target architecture for a single SMX platform with:

- one login
- shared identity and session management
- product-aware access control
- a clean separation between `Ad Server` and `Studio`
- a migration path that avoids endpoint-by-endpoint patching

This document is the source of truth for moving from the current mixed staging state to a scalable, decoupled platform.

## Product goals

The platform should support a single authenticated experience where:

- `admin` users can access both `Ad Server` and `Studio`
- `designer` users can access `Studio` only
- `ad ops` users can access `Ad Server` only
- future roles can be added without redesigning auth or routing

The platform should remain operationally simple while clearly separating domain responsibilities.

## Current state

### What already exists in the monorepo

- `apps/studio`
  The Studio frontend
- `apps/web`
  The Ad Server frontend
- `apps/api`
  A newer platform API with:
  - `auth`
  - `workspaces`
  - `projects`
  - `assets`
  - `health`
- `apps/worker`
  Background jobs and maintenance
- `packages/db`
  Shared schema and migration scripts
- `packages/contracts`
  Shared runtime contracts

### What still only exists in the legacy backend

The Ad Server frontend depends on backend domains that are not yet present in the current `apps/api`:

- `campaigns`
- `tags`
- `reporting`
- `pacing`
- `discrepancies`
- `api-keys`
- `webhooks`
- `pixels`
- `tracking`
- `ab-testing`
- `search`
- `vast`
- `audit`
- parts of team/access operations

### Why staging became unstable

The frontend for `Ad Server` was restored, but it was pointed at a backend that currently implements only the core platform domains.

That means the current problem is architectural, not cosmetic:

- the `Ad Server` frontend expects the full ad-serving domain
- the new backend currently exposes only the core identity/workspace/studio-adjacent surface

Fixing individual endpoints does not solve the system mismatch.

## Architecture principles

The platform should follow these principles:

### 1. One identity system

Authentication and session management must be centralized.

There should be one canonical source of truth for:

- users
- sessions
- workspace memberships
- roles
- permissions
- product entitlements

### 2. Product domains are separate

`Ad Server` and `Studio` are separate products.

They may share:

- login
- user identity
- workspace model
- assets
- publication flows

They should not share UI assumptions or backend route ownership.

### 3. Migrate bounded contexts, not endpoints

We should move whole domains from legacy to the new platform:

- `campaigns`
- `tags`
- `reporting`

not isolated routes one by one.

### 4. Prefer modular monolith over premature microservices

The immediate target should be a modular monolith with strong boundaries.

That gives:

- fast local development
- simpler deploys
- lower operational overhead
- cleaner extraction later if a domain outgrows the monolith

### 5. Contracts must be explicit

Frontend and backend should meet through stable contracts defined in code, not through implicit assumptions.

## Target architecture

### Frontends

- `apps/portal`
  Shared authenticated launcher and product shell
- `apps/web`
  Ad Server frontend
- `apps/studio`
  Studio frontend

`apps/portal` may be introduced later. In the short term, the current product entrypoints can remain separate, but the long-term target is:

- `app.duskplatform.co`
  unified launcher / product router
- `studio.duskplatform.co`
  direct Studio entry
- optional `adserver.duskplatform.co`
  direct Ad Server entry if needed

### Backend

`apps/api` should become a domain-oriented API with clear module ownership.

Recommended structure:

- `modules/core/auth`
- `modules/core/access`
- `modules/core/workspaces`
- `modules/core/projects`
- `modules/core/assets`

- `modules/adserver/campaigns`
- `modules/adserver/tags`
- `modules/adserver/reporting`
- `modules/adserver/pacing`
- `modules/adserver/discrepancies`
- `modules/adserver/api-keys`
- `modules/adserver/webhooks`
- `modules/adserver/pixels`
- `modules/adserver/tracking`
- `modules/adserver/ab-testing`
- `modules/adserver/search`
- `modules/adserver/vast`

- `modules/studio/hub`
- `modules/studio/editor`
- `modules/studio/publication`

### Worker

`apps/worker` remains the async execution layer for:

- maintenance
- asset processing
- publication pipelines
- scheduled cleanup
- long-running ad-serving side jobs where needed

The worker should depend on stable domain services, not frontend behavior.

## Identity and access model

### Core entities

- `users`
- `sessions`
- `workspaces`
- `workspace_members`
- `projects`
- `assets`

### Access concepts

Each workspace membership should carry:

- role
- product access
- permission set

Recommended shape:

- `role`
  - `admin`
  - `designer`
  - `ad_ops`
  - `reviewer`
  - more as needed

- `product_access`
  - `ad_server: boolean`
  - `studio: boolean`

- `permissions`
  Derived from role plus optional workspace overrides

### Runtime behavior

When a user logs in:

1. create session
2. resolve memberships
3. resolve active workspace
4. resolve product access
5. choose landing product

Landing rules:

- if user has both products and is `admin`
  - show unified launcher
- if user has only `studio`
  - go directly to Studio
- if user has only `ad_server`
  - go directly to Ad Server

## Routing target

### Core auth API

The canonical auth surface should remain minimal and stable:

- `GET /v1/auth/session`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`

The session payload should be rich enough to drive product routing:

- user
- active workspace
- memberships
- permissions
- product access

### Product APIs

The frontend should never guess product capability from missing routes.

Instead:

- `Ad Server` frontend talks only to ad-server modules
- `Studio` frontend talks only to studio modules
- shared shell uses the auth session contract only

## Migration strategy

### Phase 0. Freeze the target

Stop mixing partial migrations in staging.

From this point on:

- core identity/workspace model in the new backend is the source of truth
- domain migrations happen whole-module at a time

### Phase 1. Stabilize the shared platform core

Keep and harden:

- auth
- sessions
- workspaces
- projects
- assets
- worker + DB migrations

Success criteria:

- login is stable
- sessions are stable
- workspace switching is stable
- Studio auth stays healthy

### Phase 2. Reintroduce the Ad Server domain into the new backend

Port the minimum usable Ad Server stack from legacy:

1. `campaigns`
2. `tags`
3. `reporting`

These three domains unblock most of the current frontend failures.

Success criteria:

- `/v1/campaigns`
- `/v1/tags`
- reporting dashboards
- overview
- campaign list/editor
- tag list/reporting

all work against the new backend

### Phase 3. Port operational modules

Next modules:

4. `pacing`
5. `discrepancies`
6. `api-keys`
7. `webhooks`

Success criteria:

- operator workflows are back
- system and team tooling is not tied to legacy

### Phase 4. Port serving and delivery modules

Final Ad Server critical path:

8. `pixels`
9. `tracking`
10. `vast`
11. `search`
12. `ab-testing`
13. `audit`

Success criteria:

- tag delivery
- tracking
- VAST generation
- validation
- search
- experimentation
- auditability

are all served from the new API

### Phase 5. Introduce unified portal routing

Once both products are stable on the same identity layer:

- add `apps/portal`
  or
- evolve the main entry shell into a proper product launcher

Success criteria:

- one login
- one identity system
- correct product routing by role and entitlement

## Deployment strategy

### Near term

Keep deployments explicit:

- `studio-staging`
  Studio frontend
- `app-staging`
  Ad Server frontend
- `api-staging`
  unified backend
- `worker-staging`
  unified worker
- `db-staging-clean`
  clean managed database

### Long term

Move toward a single platform release train where:

- backend domains are versioned together
- frontend builds are versioned per product
- DB migrations are part of a planned release cycle

## Non-goals

This blueprint explicitly avoids:

- rewriting Ad Server from scratch
- rewriting Studio from scratch
- introducing microservices immediately
- keeping indefinite compatibility shims for legacy route shapes
- mixing old backend and new backend behind the same product forever

## Immediate next implementation step

The next engineering step should be:

### Port the Ad Server minimum domain into `apps/api`

Start with:

1. `campaign-routes`
2. `tag-routes`
3. `tag-reporting-routes`
4. `reporting/routes`

Then wire them into:

- `/Users/enzocienfuegos/Documents/New project/apps/api/src/app.mjs`

Only after that should we continue validating `app-staging`.

## Success definition

We are done when:

- one login authenticates all users
- product access is determined by role and entitlement
- `admin` users can access `Ad Server` and `Studio`
- `designer` users can access only `Studio`
- `Ad Server` does not depend on the legacy backend
- `Studio` does not depend on Ad Server route assumptions
- the worker and DB are shared only where the domain model is intentionally shared

