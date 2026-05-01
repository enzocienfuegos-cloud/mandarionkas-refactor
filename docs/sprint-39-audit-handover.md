# Sprint 39 Audit Handover

## Purpose

This document is the handoff package for the development team to audit Sprint 39 work with a senior-engineering lens:

- structural coherence
- decoupling quality
- scalability
- operational risk
- migration completeness

This is not a release note.
It is an engineering audit summary of what changed, what is stable, what is partially complete, and what still needs review.

## Executive summary

Sprint 39 materially moved the repository from a mixed product codebase toward a unified platform shape:

- `apps/api` is now the effective modular backend for core platform concerns and most Ad Server domains.
- `apps/web` remains the Ad Server frontend, but now consumes clearer platform contracts such as `product_access`, `platform_role`, and explicit permissions.
- `apps/studio` remains a separate product with strong internal architecture guardrails.
- `apps/portal` now exists as a thin identity-and-routing shell, but operational cutover is not complete.

The architectural direction is now mostly correct:

- identity is centralizing
- product access is explicit
- the portal is thin instead of becoming a third domain monolith
- Ad Server and Studio remain separate product surfaces

The main unresolved operational risk is still the video rendition worker flow.
Multiple correctness improvements were made, but the end-to-end automatic transcode path is still not trustworthy enough to treat as closed without a dedicated audit.

## Current repo topology

### Applications

- `apps/api`
  Unified backend for platform and Ad Server domains
- `apps/web`
  Ad Server frontend
- `apps/studio`
  Studio frontend
- `apps/portal`
  Unified launcher and identity shell
- `apps/worker`
  Background polling worker

### Shared packages

- `packages/db`
  Database access, migrations, import/seed logic
- `packages/contracts`
  Shared runtime contracts
- `packages/config`
  Shared configuration/security helpers
- `packages/vast`
  Shared VAST-related logic

## What Sprint 39 changed

### 1. Platform identity and access model

The sprint moved the platform toward explicit separation between:

- `platform_role`
  Who the user is on the platform
- `product_access`
  Which product(s) the user can access in a workspace
- workspace membership role
  `owner`, `admin`, `member`, `viewer`

#### Implemented changes

- `platform_role` is now persisted and preferred in auth/session flows.
- Session payloads expose `productAccess`.
- Workspace and team management flows accept platform-role vocabulary:
  - `admin`
  - `designer`
  - `ad_ops`
  - `reviewer`
- Client access management now maps platform roles into workspace roles and explicit `product_access`.

#### Architectural value

- decouples identity from product entitlement
- prevents role semantics from being inferred implicitly from frontend assumptions
- supports future products better than the old `editor`-centric model

#### Remaining concern

Production and staging rollout still need operational verification against old data.
The code now writes the new model more consistently, but environments must still be migrated and validated.

## 2. Portal shell

`apps/portal` was created as a thin shell rather than a new business monolith.

### Scope of `apps/portal`

- login
- register
- launcher
- workspace switching
- routing to Ad Server or Studio based on `product_access`

### Why this is the correct shape

- keeps domain logic inside `apps/web` and `apps/studio`
- avoids microfrontend complexity
- keeps unified identity separate from product-specific workflows

### Current state

- code exists
- build exists
- deploy spec exists
- env vars and DNS docs exist
- cutover is not finished

### Important limitation

The portal is ready as code, not yet complete as the canonical production entrypoint.

## 3. Ad Server backend convergence

`apps/api` now contains the effective modular backend shape for most Ad Server domains.

### Core/platform modules present

- `auth`
- `audit`
- `workspaces`
- `projects`
- `assets`
- `health`

### Ad Server modules present

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
- `pixels`
- `tracking`

### Architectural assessment

This is now close to a modular monolith with domain boundaries, which is the right intermediate target.
It is materially better than endpoint-by-endpoint legacy patching.

## 4. Ad Server frontend convergence

The frontend work in `apps/web` moved from implicit product assumptions toward platform-aware behavior.

### Key changes

- launcher flow understands `product_access`
- Settings and team management understand `platform_role`
- audit is permission-aware
- tags now expose:
  - `Reporting`
  - `Tracking`
  - `Pixels`

### Why this matters

This closes the gap where backend modules existed but product UI still made the platform look unfinished.

## 5. Studio boundary posture

Studio was not collapsed into the new platform shell.
That is good.

Studio still preserves explicit architectural guardrails:

- UI layers cannot import legacy repositories or raw storage directly
- raw `fetch()` is limited to adapters
- raw browser storage is limited to adapters
- `domain/` cannot depend on top-level delivery/export/platform layers

This is a healthy sign.
It means Studio remains a bounded product, not an accidental dumping ground.

## 6. Worker and video rendition work

This is the area that needs the strongest scrutiny.

### Intended automatic flow

The intended video ingestion flow is:

1. upload file
2. complete ingestion
3. publish creative
4. create source creative version
5. create ladder plan for `1080p`, `720p`, `480p`
6. enqueue transcode job automatically
7. worker picks the job
8. worker uploads outputs
9. creative version metadata and rendition rows move to a finished state
10. renditions become activatable without regeneration

### What actually went wrong

The system repeatedly fell into states where:

- publish returned `200`
- the UI polled `GET /v1/creative-versions/:id`
- the worker remained `idle / no_pending_jobs`
- renditions were shown as:
  - stale `97%`
  - `queued`
  - `N/A`
  - `stalled`
- manual `Regenerate renditions` often worked, but automatic post-publish transcode did not

### Problems identified during the sprint

#### A. Stale processing metadata

Creative version metadata could remain in `processing` even after the worker had completed a job.

Impact:

- frontend showed phantom progress
- operators could not trust UI state

#### B. Ambiguous rendition status model

The system mixed several cases:

- technically impossible rendition
- not generated yet
- queued but not claimed
- stalled with no active job
- paused by user

Impact:

- `N/A` was sometimes shown for cases that were actually recoverable
- activation behavior became confusing

#### C. Automatic queue prerequisites were fragile

Auto-enqueue depended on source data like:

- `storage_key`
- `public_url`
- source artifact presence

When these were incomplete or derived inconsistently, publish could succeed while no transcode job was actually enqueued.

#### D. Job deduplication semantics were too broad

Deduplication by `asset_id` created cases where one stale or old job could block a new creative-version-specific transcode path.

#### E. Autorecovery semantics were too aggressive in some cases

At one point, a `paused` rendition could be misread as needing regeneration.

Impact:

- turning off a rendition could trigger regeneration behavior that should only happen on explicit `Regenerate renditions`

#### F. Frontend status communication was misleading

The UI used progress language where it should have used operational language.

The team corrected messaging toward:

- `N/A`
  only for technically impossible renditions
- `Stalled`
  when the source supports the ladder but no job is progressing
- `Retry required`
  for failed/stuck ladder entries

### What was changed

Multiple fixes were made across:

- `packages/db/src/creatives.mjs`
- `apps/api/src/modules/adserver/creatives/routes.mjs`
- `apps/worker/src/jobs/transcode-video.mjs`
- `apps/web/src/creatives/CreativeLibrary.tsx`

#### Changes made

- ladder planning now always models `1080p`, `720p`, `480p`
- technically impossible profiles are explicitly marked `unavailable`
- feasible profiles are queued
- creative-version processing state is updated more consistently
- API-side autorepair attempts to requeue when the version still needs renditions
- activation now checks whether a rendition actually has a published asset
- `paused` no longer implies regenerate
- UI separates `N/A` from `Stalled`
- source `storage_key` fallback logic was strengthened
- `trimText` runtime breakage was fixed
- dedupe logic was tightened toward `creativeVersionId` instead of only `asset_id`

### Senior assessment of the worker state

This area is improved, but not yet proven.

The worker flow has too many responsibilities split across:

- DB planning
- API publish behavior
- API autorepair-on-read behavior
- worker-side ffmpeg execution
- metadata reconciliation
- frontend interpretation

That architecture is serviceable for now, but still too fragile for a “bulletproof” claim.

### Recommendation

Treat video renditions as an open operational audit item, not a completed feature.

Recommended next step:

- stop patching symptoms
- do a focused redesign review of the transcode pipeline contract
- define a single canonical source of truth for:
  - queue state
  - rendition state
  - creative version processing state
- ensure UI state is derived from job truth, not reconstructed heuristically

## How the worker works today

The worker is a polling process.

### Loop structure

`apps/worker/src/worker.mjs` runs a repeating cycle:

1. `maintenance`
2. `image-derivatives`
3. `transcode-video`
4. `generate-thumbnails`
5. `extract-metadata`

Default poll interval:

- `WORKER_POLL_INTERVAL_MS`
- fallback `30000`

### Active jobs

#### `maintenance`

- expires pending upload sessions
- revokes expired auth sessions
- prunes old drafts

#### `image-derivatives`

- claims `image-derivatives` jobs
- optionally runs Sharp
- uploads outputs to R2
- patches asset optimization metadata

#### `transcode-video`

- claims `video-transcode` jobs
- downloads source video
- runs ffmpeg
- uploads outputs to R2
- syncs outputs back into creative-version rendition rows
- updates creative-version video-processing state

#### `generate-thumbnails`

- currently stub

#### `extract-metadata`

- currently stub

### Worker architectural strengths

- isolated polling process
- environment-driven feature flags
- job claiming from DB
- explicit metadata patching

### Worker architectural weaknesses

- queue truth and rendition truth are still partially reconstructed from different layers
- some recovery behavior happens in API reads instead of a dedicated reconciler
- stub jobs show the worker is not yet a uniformly mature job system
- video flow still relies on coordination between API heuristics and worker behavior

## Tags domain: current behavior

Tags are now one of the clearest examples of the new platform shape.

### Backend

Tags are backed by dedicated modules in `apps/api`:

- `tags`
- `reporting`
- `pixels`
- `tracking`
- `vast`

### Frontend

The tag product surface now includes:

- tag list
- tag editor
- health
- reporting
- creative assignments
- pixels
- tracking

### Architectural quality

This is a good bounded context now.
It has clearer domain ownership than before and is one of the stronger areas for audit confidence.

## Ad Server: current behavior

Ad Server remains in `apps/web`.

### Domain coverage

- campaigns
- tags
- creatives
- reporting
- pacing
- discrepancies
- experiments
- webhooks
- API keys
- tools
- search
- settings

### Platform integration improvements

- reads `product_access`
- reads `platform_role`
- now consumes explicit permissions
- launcher can hand off to portal or Studio

### Architectural assessment

Ad Server is still a large SPA, but it is now operating against more explicit platform contracts.
That reduces hidden coupling even if the app is still broad in scope.

## Studio: current behavior

Studio remains its own frontend application.

### Current characteristics

- dedicated React/Vite app
- architecture guardrails exist in tests
- domain and repository layering are explicitly protected
- product concerns remain separate from Ad Server

### Architectural assessment

Studio is the healthiest bounded frontend in the repository.
The right move was to integrate it through portal and auth, not fold it into `apps/web`.

## Key architectural wins from Sprint 39

- The platform now has an explicit shape.
- `apps/portal` is correctly thin.
- `apps/api` is now meaningfully modular.
- `platform_role` and `product_access` are no longer implicit-only concepts.
- tags/reporting/pixels/tracking now reflect backend progress in the UI.
- audit permissions are now explicit.

## Key architectural risks still open

### 1. Portal cutover is not done

Code exists.
Operational entrypoint migration does not.

### 2. Worker video pipeline is still fragile

It has improved, but the flow still needs dedicated review.

### 3. Legacy data rollout is not finished

The write path is better.
Environment migration and backfill validation are still operational tasks.

### 4. Permission model is cleaner, but still young

It now exists explicitly in frontend-visible contract form.
It still needs wider adoption and hardening across all admin/backoffice surfaces.

## Recommended audit questions for the team

1. Is `apps/portal` the final shell, or should it remain intentionally minimal and permanent?
2. Is the current permission model sufficient, or should permissions be separated from roles in storage next?
3. Should the video worker be redesigned around a dedicated reconciler and stricter state machine?
4. Is `apps/web` still too broad, or is the modular backend now sufficient to keep the frontend manageable?
5. Which staging/prod datasets still depend on legacy `editor` assumptions?

## Recommended next steps

### Short term

- finish portal deploy cutover
- run migration validation for `platform_role` and `product_access`
- audit worker queue and rendition tables in staging

### Medium term

- define canonical state machine for video transcode lifecycle
- reduce API “autorepair on GET” behavior if possible
- tighten backoffice permissions around audit and access management

### Long term

- consider whether Ad Server frontend should be split by subdomain or remain one SPA over modular API
- evaluate whether worker jobs should move from poll-only semantics toward a more explicit orchestrated queue model

## Final senior assessment

Sprint 39 produced meaningful structural progress.
It was not just patching.

The platform shape is now substantially better than before:

- more explicit
- more decoupled
- more scalable
- easier to reason about

However, the sprint should be considered:

- architecturally successful
- operationally partial

The unified platform direction is now correct.
The remaining risk is mostly in:

- deploy cutover
- data rollout
- worker/video reliability

That is a much better place to be than before the sprint, but it is not yet “done” in the operational sense.
