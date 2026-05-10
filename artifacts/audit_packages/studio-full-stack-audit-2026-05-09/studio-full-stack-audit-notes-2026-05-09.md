# Studio Full-Stack Audit Notes — 2026-05-09

## 1. Purpose

This package is meant to audit **Studio as a product**, not only the editor UI.

It includes:

- frontend application code in `apps/studio`
- backend API surface that Studio depends on in `apps/api`
- shared DTO/contracts in `packages/contracts`
- database persistence, migrations, and seed/runtime helpers in `packages/db`
- staging deployment config relevant to Studio

The goal is to let another developer inspect:

- functional coverage
- architectural boundaries
- state and persistence contracts
- widget and render architecture
- export behavior
- auth, workspace, project, and asset flows
- likely scalability and hardcode hotspots

---

## 2. Package Contents

Core included scope:

- `apps/studio/`
- `apps/api/`
- `packages/contracts/`
- `packages/db/`
- `infra/do/studio.staging.app.yaml`
- root `package.json`
- root `package-lock.json`
- root `tsconfig.base.json`
- this audit note

Deliberately excluded:

- `node_modules/`
- generated `dist/`
- local `.env` secrets
- unrelated product surfaces (`apps/web`, `apps/portal`, most ad-server-only routes)

---

## 3. Recommended Read Order

If someone is new to Studio, this order is the fastest way to orient:

1. `apps/studio/src/platform/`
2. `apps/studio/src/app/shell/`
3. `apps/studio/src/domain/document/`
4. `apps/studio/src/core/store/`
5. `apps/studio/src/widgets/registry/`
6. `apps/studio/src/widgets/modules/`
7. `apps/studio/src/export/`
8. `apps/studio/src/repositories/`
9. `apps/api/src/modules/auth/`
10. `apps/api/src/modules/workspaces/`
11. `apps/api/src/modules/projects/`
12. `apps/api/src/modules/assets/`
13. `packages/contracts/src/`
14. `packages/db/migrations/`
15. `packages/db/src/`

---

## 4. System Overview

Studio is split into four main layers:

### Frontend product app

`apps/studio`

Owns:

- login and session handling
- workspace hub and project selection
- editor shell
- canvas, timeline, inspector, left rail
- widget rendering and authoring
- export generation
- local preferences and browser-only helpers

### Backend API

`apps/api`

Owns:

- auth session/login/logout
- workspace membership and access
- project CRUD and versioning
- user drafts
- asset upload, foldering, remote asset ingestion, reprocessing
- preferences and saved views

### Shared contracts

`packages/contracts`

Owns:

- DTOs between frontend and backend
- permission and platform-access vocabulary
- project state request/response types
- some export/runtime helpers shared across products

### Persistence and jobs

`packages/db`

Owns:

- PostgreSQL schema migrations
- SQL/data access helpers
- asset job enqueueing
- creative/export-adjacent storage helpers
- seed/demo data

---

## 5. Main Product Flows

### 5.1 Auth and session

Frontend entrypoints:

- `apps/studio/src/platform/LoginScreen.tsx`
- `apps/studio/src/platform/auth-service.ts`
- `apps/studio/src/platform/providers/`

Backend:

- `apps/api/src/modules/auth/routes.mjs`
- `apps/api/src/modules/auth/service.mjs`
- `apps/api/src/lib/session.mjs`

Behavior:

- `GET /v1/auth/session` restores the active session
- `POST /v1/auth/login` creates a session and returns cookie state
- `POST /v1/auth/logout` revokes the current session
- local non-prod fallback exists in frontend auth service for offline/dev smoke

Audit risks:

- frontend fallback auth can drift from backend behavior if not periodically checked
- cookie/session semantics are in backend libs, while frontend also has local fallback branching

### 5.2 Workspace and project hub

Frontend:

- `apps/studio/src/platform/AgencyShell.tsx`
- `apps/studio/src/platform/ClientWorkspaceShell.tsx`
- `apps/studio/src/platform/workspace-hub/`

Backend:

- `apps/api/src/modules/workspaces/routes.mjs`
- `apps/api/src/modules/workspaces/service.mjs`
- `apps/api/src/modules/projects/routes.mjs`
- `apps/api/src/modules/projects/service.mjs`

Behavior:

- list workspaces for current user
- switch active workspace
- view team members and invite/update/remove them
- list, create, duplicate, archive, restore, delete projects
- transfer ownership

Audit risks:

- workspaces routes are large and cover multiple concerns
- project service contains both naming/metadata derivation and persistence/update logic

### 5.3 Editor bootstrap

Frontend:

- `apps/studio/src/App.tsx`
- `apps/studio/src/app/bootstrap/`
- `apps/studio/src/app/shell/Workspace.tsx`
- `apps/studio/src/core/store/studio-store.ts`

Behavior:

- load project state from backend repositories
- normalize older snapshots into current domain shape
- hydrate studio store
- render shell around stage/timeline/inspector

Key contracts:

- document snapshot shape in `apps/studio/src/domain/document/types.ts`
- persistence compatibility in `apps/studio/src/domain/document/normalize-state.ts`
- DTO boundary in `packages/contracts/src/projects.ts`

### 5.4 Canvas authoring

Frontend:

- `apps/studio/src/canvas/stage/Stage.tsx`
- `apps/studio/src/canvas/stage/components/`
- `apps/studio/src/canvas/stage/controllers/`
- `apps/studio/src/canvas/stage/render-widget.tsx`

Behavior:

- widget selection
- drag/resize/rotate
- multi-select
- drop preview
- rulers, overlays, floating toolbar
- wireframe mode
- preview frame contexts

Audit risks:

- `Stage.tsx` is still one of the biggest and most behavior-dense files
- geometry, gesture, overlays, and selection UX meet in one surface

### 5.5 Timeline

Frontend:

- `apps/studio/src/timeline/`
- `apps/studio/src/timeline/components/`

Behavior:

- scene navigation
- playhead
- layer tracks
- timing bars
- shared layer badges
- overview and ruler

Audit risks:

- some timeline runtime positioning remains necessarily dynamic
- UX and state concerns are spread across component files plus reducers/selectors

### 5.6 Inspector

Frontend:

- `apps/studio/src/inspector/panels/`
- `apps/studio/src/inspector/sections/`
- `apps/studio/src/widgets/registry/widget-inspector-layout.tsx`

Behavior:

- document inspector
- widget inspector
- multi-select inspector
- section gating by widget capabilities and predicates
- per-widget overrides by canvas variant and scene

Audit risks:

- the system is more registry-driven now, but still has many section components
- behavior is easier to extend than before, but still broad

### 5.7 Widget system

Frontend:

- `apps/studio/src/widgets/registry/`
- `apps/studio/src/widgets/modules/`
- `apps/studio/src/widgets/*/`

Behavior:

- registry of definitions
- capabilities
- thumbnails and library previews
- stage renderer
- export renderer
- inspector integration
- shared defaults per widget family

Important current state:

- render-layer tokenization closeout is now complete for active renderers
- `render-tokenized` contract covers `30` active widget renderers
- color literal guardrail lives in `apps/studio/scripts/lint-color-literals.mjs`

Audit risks:

- `dynamic-map.renderer.tsx` and `four-faces.renderer.tsx` are still big even after cleanup
- widget complexity is highly uneven across modules
- export HTML lives separately from stage runtime, so parity must be audited consciously

### 5.8 Export

Frontend:

- `apps/studio/src/export/`
- `apps/studio/src/widgets/modules/export-renderers.ts`
- `apps/studio/src/export/html.ts`
- `apps/studio/src/export/bundle.ts`
- `apps/studio/src/export/portable.ts`

Behavior:

- standalone HTML export
- portable project export
- adapter-specific packaging
- multi-size bundle export
- asset dedupe under shared bundle paths
- Leaflet srcdoc generation for map widgets

Key point:

- export is largely frontend-owned
- backend does not render widgets server-side; backend persists project/assets and provides upload/storage support

Audit risks:

- `export-renderers.ts` remains a hotspot because output HTML is inherently literal-heavy
- parity between stage renderer and export renderer should be checked widget-by-widget for critical modules

### 5.9 Assets

Frontend:

- `apps/studio/src/repositories/asset/`
- `apps/studio/src/app/shell/AssetLibraryModal.tsx`
- `apps/studio/src/app/shell/left-rail/AssetLibrarySection.tsx`

Backend:

- `apps/api/src/modules/assets/routes.mjs`
- `apps/api/src/modules/assets/service.mjs`

DB:

- `packages/db/src/asset-jobs.mjs`
- migrations around asset processing and video transcode jobs

Behavior:

- list folders/assets
- prepare upload
- complete upload
- save remote asset
- reprocess asset
- R2 signing and object storage support

Audit risks:

- asset service is large and handles both persistence and signing/orchestration
- asynchronous processing introduces eventual-consistency edges

### 5.10 Preferences, saved views, comments, approvals

Frontend:

- inspector document sections
- toast/tooltip systems
- local preferences under `apps/studio/src/inspector/`, `app/shell/`, `canvas/stage/`

Backend:

- `apps/api/src/modules/preferences/routes.mjs`
- `apps/api/src/modules/saved-views/routes.mjs`
- audit trail routes/module

Behavior:

- preferences persistence
- saved views
- comments and approvals currently operate mostly as editor-side UX/data modeling surfaces

Audit risks:

- distinguish clearly between product-complete UX and backend-backed collaboration features
- some collaboration surfaces may still be UX-first rather than deeply integrated workflow engines

---

## 6. Contracts and Boundaries

### Frontend document model

Primary file:

- `apps/studio/src/domain/document/types.ts`

Important concepts now present:

- scenes
- widgets
- canvas variants
- shared layers
- per-variant widget overrides
- per-scene shared-layer overrides
- preview context

### Store and reducers

Primary files:

- `apps/studio/src/core/store/studio-store.ts`
- `apps/studio/src/core/store/reducers/`
- `apps/studio/src/core/store/selectors/`

The store is the core authoring state boundary. Most shell, stage, timeline, and inspector behavior hangs off this layer.

### Repository boundary

Primary files:

- `apps/studio/src/repositories/services.ts`
- `apps/studio/src/repositories/mode.ts`
- `apps/studio/src/repositories/*`

This is the frontend boundary between editor logic and backend transport. Audit here if you want to understand:

- local/demo mode
- API mode
- draft/project/version save flows
- asset and analytics transport

### API DTOs

Primary files:

- `packages/contracts/src/projects.ts`
- `packages/contracts/src/auth.ts`
- `packages/contracts/src/assets.ts`
- `packages/contracts/src/platform.ts`
- `packages/contracts/src/index.ts`

These are the shared types to compare against:

- frontend repository expectations
- backend route payloads
- persistence snapshot assumptions

### Persistence schema

Primary area:

- `packages/db/migrations/`

Studio-relevant schema areas include:

- sessions
- user drafts
- projects
- project documents
- project versions
- assets and asset folders
- workspace access
- user preferences and saved views
- video transcode support

---

## 7. API Surface Summary

Studio-critical route groups:

### Auth

- `/v1/auth/session`
- `/v1/auth/login`
- `/v1/auth/logout`
- `/v1/auth/health`

### Workspaces and team

- `/v1/workspaces`
- `/v1/workspace`
- `/v1/team`
- `/v1/team/invite`
- member role/update/remove flows

### Projects

- `/v1/projects`
- `/v1/projects/save`
- `/v1/projects/:id`
- `/v1/projects/:id/duplicate`
- `/v1/projects/:id/archive`
- `/v1/projects/:id/restore`
- `/v1/projects/:id/owner`
- `/v1/projects/:id/versions`
- draft save/load/delete flows

### Assets

- `/v1/assets`
- `/v1/assets/folders`
- `/v1/assets/upload-url`
- `/v1/assets/uploads/:id/complete`
- `/v1/assets/health`
- rename/delete/reprocess flows

### Preferences and saved views

- preferences routes
- saved-views routes

---

## 8. Widget and Export Architecture

### Registry model

Key files:

- `apps/studio/src/widgets/registry/widget-definition.ts`
- `apps/studio/src/widgets/registry/widget-registry.ts`
- `apps/studio/src/widgets/modules/module-definition-factory.ts`

Definition responsibilities:

- metadata
- capabilities
- thumbnail
- library preview
- stage renderer
- export renderer
- inspector layout sections

### Module families

Large widget families include:

- `dynamic-map`
- `interactive-video`
- `tiktok-video`
- `instagram-story`
- `meta-carousel`
- `four-faces`
- `vertical-accordion`
- `speed-test`
- `shoppable-sidebar`
- `image-carousel`

### Shared defaults cleanup

Several widget families now have `*.shared.ts` files so copy/labels/defaults do not drift between:

- definitions
- inspectors
- stage renderers
- export renderers

### Export split

There are three important export layers:

1. widget export rendering
2. portable project generation
3. bundle/adapters/HTML packaging

Audit these together:

- `apps/studio/src/widgets/modules/export-renderers.ts`
- `apps/studio/src/export/portable.ts`
- `apps/studio/src/export/html.ts`
- `apps/studio/src/export/bundle.ts`
- `apps/studio/src/export/adapters/`

---

## 9. Hotspots and Scalability Risks

Top large files in current included scope:

- `apps/studio/src/widgets/modules/dynamic-map.renderer.tsx`
- `apps/studio/src/export/runtime-script.ts`
- `apps/studio/src/widgets/modules/four-faces.renderer.tsx`
- `apps/studio/src/widgets/modules/export-renderers.ts`
- `apps/studio/src/canvas/stage/Stage.tsx`
- `apps/api/src/modules/assets/service.mjs`
- `apps/api/src/modules/workspaces/routes.mjs`
- `apps/api/src/modules/projects/service.mjs`
- `packages/db/src/creatives.mjs`
- `packages/db/src/reporting.mjs`

Interpretation:

- frontend hotspots are still concentrated in stage, export, and a few heavyweight widgets
- backend hotspots are mostly service/router concentration and broad persistence modules
- DB layer contains some very large product-multipurpose files; not all are Studio-only, but they matter if Studio touches them indirectly

Specific audit questions to ask:

1. Is `Stage.tsx` carrying too many responsibilities that should be split further?
2. Are `projects/service.mjs` and `assets/service.mjs` mixing too much normalization, authorization, and persistence?
3. Does `export-renderers.ts` need a second decomposition pass by widget family?
4. Are there cases where stage and export can drift because their render paths are too independent?
5. Are variant/shared-layer overrides sufficiently isolated and test-covered?

---

## 10. Hardcode and Tokenization State

Important current posture:

- `apps/studio/src` was cleaned to `0` `style={{...}}` in `*.tsx`
- shared CSS tokenization was substantially normalized
- render-layer tokenization contract now covers all active widget renderers
- `lint-color-literals.mjs` guards opted renderers against regression

However, audit should still check:

- export HTML literals that are output-specific and not necessarily wrong
- backend defaults hardcoded in service layers
- demo/dev auth fallback behavior
- widget-specific brand palettes vs generic theme values

---

## 11. Recommended Audit Checklist

### Product behavior

- Can you log in, switch workspace, open project, create/open editor?
- Does project save/version/draft flow match the API contract?
- Does asset upload and completion map cleanly from frontend repository to backend route/service to DB?
- Does export faithfully reflect stage state for critical widgets?

### Architecture

- Is the document model coherent after variants/shared layers?
- Are repository boundaries respected, or is UI reaching around them?
- Are widget definitions the real single source of truth?
- Do contracts in `packages/contracts` still match actual usage?

### Scalability

- Which files are over-concentrated?
- Which backend services mix too many concerns?
- Which widgets still deserve decomposition?
- Where do ad-server and Studio concerns still share too much DB surface?

### Regression guardrails

- run `npm run lint -w @smx/studio`
- run `npm run typecheck -w @smx/studio`
- run `npm run test -w @smx/studio`
- run `npm run build -w @smx/studio`

Optional backend checks:

- run API smoke or targeted route tests if available
- inspect migration ordering and backward compatibility assumptions

---

## 12. Bottom Line

Studio is no longer “just a frontend editor”; it is a bounded product composed of:

- a fairly rich frontend application
- a dedicated API surface for auth/workspaces/projects/assets
- shared DTO contracts
- persistent project/document/version/asset schemas

The strongest audit targets now are:

- `Stage` and `export` on the frontend
- `projects` and `assets` services on the backend
- parity between document model, repositories, DTOs, and persisted schema

For a developer auditing hardcodes, scalability, and future maintainability, this package should be enough to reason about Studio end-to-end without needing the rest of the repository.
