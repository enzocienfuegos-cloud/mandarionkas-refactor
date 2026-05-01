# Sprint 39 Offline Audit Checklist

## Purpose

Use this file when reviewing the repository offline with no prior meeting context.

This checklist is for the development team to validate:

- architecture decisions
- migration correctness
- portal cutover readiness
- worker reliability risk
- remaining TODOs after Sprint 39

## Files to read first

### Architecture and sprint context

- [docs/sprint-39-unified-platform-blueprint.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-39-unified-platform-blueprint.md)
- [docs/sprint-39-audit-handover.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-39-audit-handover.md)

### Core backend entrypoints

- [apps/api/src/app.mjs](/Users/enzocienfuegos/Documents/New%20project/apps/api/src/app.mjs)
- [apps/api/src/modules/auth/service.mjs](/Users/enzocienfuegos/Documents/New%20project/apps/api/src/modules/auth/service.mjs)
- [apps/api/src/modules/workspaces/routes.mjs](/Users/enzocienfuegos/Documents/New%20project/apps/api/src/modules/workspaces/routes.mjs)
- [apps/api/src/modules/workspaces/service.mjs](/Users/enzocienfuegos/Documents/New%20project/apps/api/src/modules/workspaces/service.mjs)

### Portal and product shell

- [apps/portal/src/App.tsx](/Users/enzocienfuegos/Documents/New%20project/apps/portal/src/App.tsx)
- [apps/web/src/shell/Shell.tsx](/Users/enzocienfuegos/Documents/New%20project/apps/web/src/shell/Shell.tsx)
- [apps/web/src/shell/ProductLauncher.tsx](/Users/enzocienfuegos/Documents/New%20project/apps/web/src/shell/ProductLauncher.tsx)

### Tags domain

- [apps/api/src/modules/adserver/tags/routes.mjs](/Users/enzocienfuegos/Documents/New%20project/apps/api/src/modules/adserver/tags/routes.mjs)
- [apps/api/src/modules/adserver/pixels/routes.mjs](/Users/enzocienfuegos/Documents/New%20project/apps/api/src/modules/adserver/pixels/routes.mjs)
- [apps/api/src/modules/adserver/tracking/routes.mjs](/Users/enzocienfuegos/Documents/New%20project/apps/api/src/modules/adserver/tracking/routes.mjs)
- [apps/web/src/tags/TagList.tsx](/Users/enzocienfuegos/Documents/New%20project/apps/web/src/tags/TagList.tsx)
- [apps/web/src/tags/TagBuilder.tsx](/Users/enzocienfuegos/Documents/New%20project/apps/web/src/tags/TagBuilder.tsx)
- [apps/web/src/tags/TagPixelsManager.tsx](/Users/enzocienfuegos/Documents/New%20project/apps/web/src/tags/TagPixelsManager.tsx)
- [apps/web/src/tags/TagTrackingDashboard.tsx](/Users/enzocienfuegos/Documents/New%20project/apps/web/src/tags/TagTrackingDashboard.tsx)

### Worker and renditions

- [apps/worker/src/worker.mjs](/Users/enzocienfuegos/Documents/New%20project/apps/worker/src/worker.mjs)
- [apps/worker/src/jobs/transcode-video.mjs](/Users/enzocienfuegos/Documents/New%20project/apps/worker/src/jobs/transcode-video.mjs)
- [packages/db/src/creatives.mjs](/Users/enzocienfuegos/Documents/New%20project/packages/db/src/creatives.mjs)
- [apps/api/src/modules/adserver/creatives/routes.mjs](/Users/enzocienfuegos/Documents/New%20project/apps/api/src/modules/adserver/creatives/routes.mjs)

### Migration and data paths

- [packages/db/migrations/0020_workspace_product_access.sql](/Users/enzocienfuegos/Documents/New%20project/packages/db/migrations/0020_workspace_product_access.sql)
- [packages/db/migrations/0021_platform_role_vocabulary.sql](/Users/enzocienfuegos/Documents/New%20project/packages/db/migrations/0021_platform_role_vocabulary.sql)
- [packages/db/src/legacy-import.mjs](/Users/enzocienfuegos/Documents/New%20project/packages/db/src/legacy-import.mjs)
- [packages/db/scripts/seed-demo-data.mjs](/Users/enzocienfuegos/Documents/New%20project/packages/db/scripts/seed-demo-data.mjs)

## Offline validation checklist

### A. Platform boundary audit

- Confirm `apps/portal` is thin and does not absorb product business logic.
- Confirm `apps/web` remains the Ad Server owner.
- Confirm `apps/studio` remains the Studio owner.
- Confirm identity and routing concerns are centralized rather than duplicated.

### B. Role and access model audit

- Confirm `platform_role` is stored on `users`.
- Confirm workspace access is modeled via `workspace_members.role`.
- Confirm `product_access` exists on memberships and invites.
- Confirm new write paths do not reintroduce `editor` into new records.
- Confirm legacy reads still degrade safely if old data remains.

### C. API modularity audit

- Confirm `apps/api/src/app.mjs` routes by bounded module, not by a single monolithic file.
- Confirm `pixels`, `tracking`, and `audit` are separate modules with clear ownership.
- Confirm new modules do not depend on frontend assumptions.

### D. Portal cutover audit

- Confirm [infra/do/portal.app.yaml](/Users/enzocienfuegos/Documents/New%20project/infra/do/portal.app.yaml) matches intended deploy topology.
- Confirm [.env.example](/Users/enzocienfuegos/Documents/New%20project/.env.example) and [.env.staging.example](/Users/enzocienfuegos/Documents/New%20project/.env.staging.example) define:
  - `VITE_PORTAL_URL`
  - `VITE_AD_SERVER_URL`
  - `VITE_STUDIO_URL`
- Confirm [infra/cloudflare/README.md](/Users/enzocienfuegos/Documents/New%20project/infra/cloudflare/README.md) matches desired hostnames.
- Confirm there is an explicit production decision about which hostname becomes canonical.

### E. Ad Server product audit

- Confirm `tags`, `pixels`, `tracking`, `reporting`, `creatives`, and `settings` are reachable from the UI.
- Confirm permissions drive visibility where appropriate.
- Confirm the shell respects `product_access`.

### F. Studio audit

- Read [apps/studio/src/testing/architecture/README.md](/Users/enzocienfuegos/Documents/New%20project/apps/studio/src/testing/architecture/README.md).
- Confirm Studio still enforces boundary tests.
- Confirm no Sprint 39 work accidentally collapsed Studio into Ad Server semantics.

### G. Worker audit

- Confirm polling loop order is acceptable.
- Confirm stub jobs are intentional and documented.
- Audit whether `transcode-video` has a reliable single source of truth for state.
- Verify that API-side requeue/recovery logic is not masking deeper queue issues.

## Known open risks to scrutinize

### 1. Video renditions

Questions for audit:

- Is `GET`-time autorepair acceptable?
- Is queue state derived cleanly?
- Can stalled jobs be diagnosed from one table/source of truth?
- Is `regenerate` correctly reserved as an explicit operator action?
- Are rendition state transitions fully deterministic?

### 2. Portal cutover

Questions for audit:

- Is there any remaining reason to keep launcher behavior in `apps/web` long term?
- Should `apps/web` remain directly accessible for Ad Ops deep links?
- Is portal meant to be permanent thin shell or transitional shell?

### 3. Legacy data

Questions for audit:

- Which production records still depend on `global_role = editor`?
- Are imported users mapped into correct `platform_role` consistently?
- Are pending invites carrying correct `product_access`?

## Commands to run offline

### Structural validation

```bash
npm run check:api
npm run build:web
npm run build:portal
npm run build:studio
```

### Optional Studio boundary validation

```bash
npm run test:studio
```

### Migration and seed sanity

```bash
node --check packages/db/scripts/seed-demo-data.mjs
node --check packages/db/src/legacy-import.mjs
npm run db:status
```

## Remaining TODOs after Sprint 39

### Operational TODOs

- Deploy `apps/portal`
- Point canonical frontend hostname to portal
- Set real portal/studio/ad-server environment variables in staging and production
- Move `PLATFORM_ALLOWED_ORIGIN` to portal hostname where appropriate
- Validate end-to-end login, workspace switching, and cross-product navigation

### Data TODOs

- Run `platform_role` migration in all live environments
- Validate imported and invited users carry correct `product_access`
- Audit for remaining legacy `editor` assumptions in live data

### Worker TODOs

- Run dedicated transcode pipeline audit
- Define authoritative state machine for rendition lifecycle
- Reduce reliance on API-side recovery heuristics if possible
- Decide whether worker queue design is sufficient for production scale

### UX TODOs

- Final polish on `audit`
- Final polish on `pixels`
- Final polish on `tracking`
- Decide whether launcher remnants in `apps/web` should be fully removed after portal cutover

## Signoff criteria

The team should not mark Sprint 39 fully complete until all of the following are true:

- `apps/portal` is deployed and functioning as intended
- `platform_role` rollout is validated in real environments
- `product_access` behaves correctly across portal, web, and studio
- tags/pixels/tracking/audit work in live environments, not just in code
- the video rendition pipeline is either:
  - proven reliable
  - or explicitly accepted as a separate follow-up risk

## Recommended team output after offline review

Produce one short engineering verdict with:

- accepted architecture decisions
- rejected or risky decisions
- must-fix items before release
- follow-up tasks that should become Sprint 40+ work
