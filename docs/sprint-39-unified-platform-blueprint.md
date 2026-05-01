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
- `ad_ops` users can access `Ad Server` only
- future roles can be added without redesigning auth or routing

The platform should remain operationally simple while clearly separating domain responsibilities.

## Current state

### Status as of 2026-05-01

This blueprint is still the right target, but the implementation is now materially ahead of the original document.

Current status by phase:

- Phase 1
  Mostly complete
- Phase 2
  Complete enough for normal Ad Server usage
- Phase 3
  Mostly complete
- Phase 4
  Partial
- Phase 5
  Partial

The main remaining Sprint 39 gaps are now:

- operational rollout of `platform_role` across existing environments and legacy datasets
- residual UX polish on `audit`, `pixels`, and `tracking`
- finishing deploy cutover so the new `apps/portal` shell becomes the canonical product entrypoint

The recent video rendition instability is operationally important, but it is not the architectural blocker for Sprint 39.
It should not drive the platform boundary decisions anymore.

### What already exists in the monorepo

- `apps/studio`
  The Studio frontend
- `apps/portal`
  The unified launcher and identity shell
- `apps/web`
  The Ad Server frontend
- `apps/api`
  The unified platform API
- `apps/worker`
  Background jobs and maintenance
- `packages/db`
  Shared schema and migration scripts
- `packages/contracts`
  Shared runtime contracts

### What is already ported into `apps/api`

Core/shared platform modules already exist:

- `auth`
- `workspaces`
- `projects`
- `assets`
- `health`

Ad Server modules already present in `apps/api`:

- `campaigns`
- `tags`
- `reporting`
- `pacing`
- `discrepancies`
- `api-keys`
- `webhooks`
- `search`
- `vast`
- `experiments`
- `creatives`

This means the platform is no longer blocked by the original "minimum Ad Server domain port" work.

### What still remains outside the target shape

The most meaningful remaining gaps are now:

- `audit` operational polish and broader backoffice adoption
- final `apps/portal` deploy/routing cutover
- role migration cleanup after `platform_role` rollout in staging and production

### Why staging is still unstable

The original mismatch described in this sprint has narrowed.

The platform now has most of the required Ad Server backend surface, but still suffers from:

- incomplete cross-cutting platform contracts
  - product-aware identity
  - workspace entitlements
  - role normalization
- unfinished delivery domains
  - `pixels`
  - `tracking`
- operational reliability gaps in already-ported modules
  - example: video rendition queue / recovery behavior

So the problem is no longer "the backend only has core modules".
The problem is now "the backend is mostly unified, but the final platform contract and a few remaining domains are still incomplete".

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
- `modules/adserver/creatives`

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

### Current implementation gap

The frontend already expects `product_access` on workspaces and in session-derived active workspace behavior.

The blueprint target remains:

- `admin`
- `designer`
- `ad_ops`
- `reviewer`

The current implementation is now split cleanly:

- `global_role`
  legacy compatibility vocabulary
- `platform_role`
  persistent platform identity contract
- `product_access`
  workspace-scoped entitlement contract

This is the intended decoupled direction for Sprint 39. The remaining work is rollout completeness, not architectural definition.

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

Status:

- mostly complete

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

Status:

- complete enough to count as done

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

Status:

- mostly complete

Success criteria:

- operator workflows are back
- system and team tooling is not tied to legacy

### Phase 4. Port serving and delivery modules

Final Ad Server critical path:

8. `pixels`
9. `tracking`
10. `vast`
11. `search`
12. `ab-testing` / `experiments`
13. `audit`

Status:

- partial

Already present in `apps/api`:

- `vast`
- `search`
- `experiments`

Still missing or not aligned with the blueprint target:

- `pixels` as a fully integrated product workflow
- `tracking` as a fully integrated product workflow
- `audit` as a fully integrated product/platform workflow

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

Status:

- not started

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

The original next step in this document is already behind us.

### Updated next engineering step

The next platform step should be:

1. promote `product_access` into the core auth/workspace contract
2. align runtime role naming with the blueprint target
3. document and then implement the missing delivery modules:
4. only after that, introduce `apps/portal` or equivalent unified launcher logic

Concretely, the next code work should focus on:

- `apps/api/src/modules/auth`
- `apps/api/src/modules/workspaces`
- the session payload returned by:
  - `GET /v1/auth/session`
- the workspace/client payloads returned by:
  - `GET /v1/workspaces`
  - `GET /v1/clients`

The goal is to make product routing and entitlement a backend-owned contract instead of a frontend convention.

## Recommended remaining backlog

### Track A. Identity unification

- make `product_access` explicit in core workspace membership flows
- normalize role vocabulary
- ensure `auth/session` can drive landing-product routing without frontend guesswork

### Track B. Delivery domain closure

- integrate `pixels` end-to-end beyond the backend CRUD surface
- integrate `tracking` end-to-end beyond the backend reporting surface
- align `audit` ownership, permissions, and product exposure end-to-end

### Track C. Product entry architecture

- decide whether `apps/portal` is a new app or an evolution of an existing shell
- add launcher behavior for:
  - dual-product admins
  - Studio-only users
  - Ad Server-only users

## Success definition

We are done when:

- one login authenticates all users
- product access is determined by role and entitlement
- `admin` users can access `Ad Server` and `Studio`
- `designer` users can access only `Studio`
- `Ad Server` does not depend on the legacy backend
- `Studio` does not depend on Ad Server route assumptions
- the worker and DB are shared only where the domain model is intentionally shared
