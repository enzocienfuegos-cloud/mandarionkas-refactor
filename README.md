<<<<<<< HEAD
# SMX Studio v4 — Sprint 48

This sprint closes the second half of the refactors started in prior sprints.

## Included
- Action side-effects extracted out of reducer execution (`src/actions/action-effects.ts`)
- `EXECUTE_ACTION` now reduces state purely and runs browser effects after dispatch
- `useStudioStore` now uses `useSyncExternalStoreWithSelector`
- `shallowEqual` wired into production store selection
- Stage uses stable selector composition from `src/core/store/selectors/stage-selectors.ts`
- `StageWidget` memoized to reduce unnecessary rerenders
- `structuredClone()` continues to be preferred for store snapshots/history
- Expanded reducer test coverage for document/scene, timeline/ui and collaboration/metadata slices

## Notes
- This sprint focuses on store/effects/performance/testing hardening.
- Interactive module renderer full extraction is still a follow-up pass; the plugin structure remains in place, but the larger shared module helper file has not been fully eliminated in this sprint.


## Sprint 68 extensibility proof

This milestone validates real extensibility by adding a new `badge` widget plugin end to end:
- widget type added to domain contracts
- widget definition registered through the widget registry
- dedicated stage renderer and export renderer
- smoke coverage proving authoring flow still works after adding the new widget

The goal is to prove that adding a new widget now touches a small, predictable surface instead of requiring cross-cutting edits across the whole editor.


## Sprint 75 — Widget plugin manifest
- Widget registration now uses declarative discovery via `import.meta.glob` over `*.definition.ts` files.
- Builtin widget registration no longer requires hand-maintaining a central array of definitions.
- Plugin manifest entries keep source metadata so extensibility tests can assert uniqueness and registration coverage.


## Source of truth

- All active frontend source code lives under `src/`.
- Root-level legacy mirrors were removed in Sprint 0 to avoid editing the wrong files.
- Use `npm run typecheck` and `npm run build` as the baseline health checks.


## Sprint 8 — Release guardrails
- GitHub Actions CI workflow added under `.github/workflows/ci.yml`
- Clean source release packaging added under `scripts/package-release.mjs`
- Baseline release verification script added under `scripts/run-release-checks.mjs`
- Release docs added under `docs/release/README.md`
- New commands:
  - `npm run release:check`
  - `npm run release:package`
  - `npm run ci:verify`
=======
# SMX Studio - DigitalOcean + PostgreSQL + Cloudflare R2 refactor

This repository has been refactored away from the old `Cloudways + PHP proxy + local Node process + R2 JSON store` runtime.

The target platform is now:

- `app.<domain>` -> DigitalOcean App Platform Static Site
- `api.<domain>` -> DigitalOcean App Platform Web Service
- background jobs -> DigitalOcean App Platform Worker + Deployment Job
- transactional data -> DigitalOcean Managed PostgreSQL
- binaries -> Cloudflare R2 behind `assets.<domain>`
- edge, DNS, TLS, WAF, cache -> Cloudflare

## Current status

### Sprint 1 completed

- monorepo split into `apps/*`, `packages/*`, `infra/*`
- legacy Cloudways runtime isolated under `legacy/cloudways`
- new API scaffold with `/healthz`, `/readyz`, `/version`
- DigitalOcean App Platform specs added
- initial PostgreSQL schema drafted

### Sprint 2 in place

- real PostgreSQL migration runner in `packages/db/scripts/run-migrations.mjs`
- session schema extended for active workspace + persistence mode
- password hashing helpers and signed cookie helpers added
- `GET /v1/auth/session`, `POST /v1/auth/login`, `POST /v1/auth/logout` now wired for PostgreSQL-backed sessions
- `GET /v1/workspaces`, `POST /v1/workspaces` and temporary `/v1/clients*` compatibility routes now use PostgreSQL
- frontend auth state no longer depends on browser-stored session ids
- frontend now restores the session from the API on boot
- demo seed script added for staging/dev bootstrapping

### Sprint 3 in place

- projects, project documents and project versions now persist in PostgreSQL
- autosave/manual drafts are cloud-only in API mode
- duplicate/archive/restore/delete/owner-change flows run against PostgreSQL

### Sprint 4 in place

- asset folders, upload sessions and asset metadata now persist in PostgreSQL
- `GET/POST /v1/assets/folders`, `GET /v1/assets`, `GET /v1/assets/:id`, `DELETE /v1/assets/:id`, `POST /v1/assets/:id/rename`
- `POST /v1/assets/upload-url` and `POST /v1/assets/complete-upload` now implement the direct-upload contract for Cloudflare R2
- direct URL / remote asset saves are supported through `POST /v1/assets`

### Sprint 5 in place

- one-shot legacy importer added in `packages/db/scripts/import-legacy-data.mjs`
- importer can read either:
  - a local exported split-data directory,
  - a single legacy `store.json`, or
  - the legacy R2 data layout directly when credentials are provided
- importer builds JSON and Markdown reconciliation reports before writing to PostgreSQL
- importer hashes legacy plaintext passwords during migration and skips legacy sessions
- importer can optionally verify imported asset `storageKey` objects against R2

### Sprint 6 in place

- `/readyz` now performs a real database ping and returns `503` when the runtime is not actually ready
- login and upload-sensitive asset routes are rate-limited in-memory per source IP
- audit logging is written to `audit_events` for workspace, project, draft and asset mutations
- `GET /v1/admin/audit-events` now exposes the latest audit entries to authorized admins
- worker now performs maintenance: expiring stale upload sessions, revoking expired auth sessions and pruning old drafts
- compatibility `/v1/clients*` routes now emit deprecation headers with a sunset date
- post-deploy smoke check added at `npm run smoke:api`

## Repo layout

```text
apps/
  web/      React + Vite editor
  api/      Stateless Node API
  worker/   Background worker scaffold
packages/
  config/   Runtime env readers + auth security helpers
  contracts/ Shared DTO source-of-truth target
  db/       SQL migrations, DB pool, migration + seed + import scripts
infra/
  do/       App Platform specs
  cloudflare/ Setup notes for DNS/TLS/cache/R2
legacy/
  cloudways/ Previous PHP proxy + Node runtime kept only for migration reference
```

## Setup

### Install

```bash
npm install
```

### Web

```bash
cp apps/web/.env.example apps/web/.env.local
npm run dev:web
```

### API

```bash
cp apps/api/.env.example apps/api/.env.local
npm run db:migrate
npm run db:seed:demo
npm run dev:api
```

### Worker

```bash
npm run dev:worker
```

## Environment variables

### Web

- `VITE_API_BASE_URL`
- `VITE_ASSETS_BASE_URL`
- `VITE_APP_ENV`

### API / worker

- `APP_NAME`
- `APP_ENV`
- `APP_ORIGIN`
- `PORT`
- `DATABASE_URL`
- `DATABASE_POOL_URL`
- `SESSION_SECRET`
- `ASSETS_PUBLIC_BASE_URL`
- `APP_GIT_SHA`
- `APP_BUILD_TIME`
- `R2_ENDPOINT`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `DRAFT_RETENTION_DAYS`

## Useful commands

```bash
npm run check:api
npm run typecheck:web
npm run build:web
npm run db:migrate
npm run db:seed:demo
npm run db:import:legacy -- --source-dir ./legacy-export
npm run smoke:api
```

## Legacy import

Local file import:

```bash
npm run db:import:legacy -- --source-dir ./legacy-export --report-json ./artifacts/legacy-import.json --report-md ./artifacts/legacy-import.md
```

Single `store.json` import:

```bash
npm run db:import:legacy -- --source-file ./store.json
```

Apply into PostgreSQL:

```bash
DATABASE_URL=postgres://... npm run db:import:legacy -- --source-dir ./legacy-export --apply --reset-target
```

Direct legacy R2 import:

```bash
LEGACY_R2_ENDPOINT=...
LEGACY_R2_BUCKET=...
LEGACY_R2_ACCESS_KEY_ID=...
LEGACY_R2_SECRET_ACCESS_KEY=...
DATABASE_URL=postgres://...
npm run db:import:legacy -- --apply
```

Optional asset verification:

```bash
R2_ENDPOINT=...
R2_BUCKET=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
npm run db:import:legacy -- --source-dir ./legacy-export --verify-assets
```

## Migration rule

Nothing in `legacy/cloudways/` should be used as runtime code again.
It stays only as a reference while the PostgreSQL + R2 migration is completed.
>>>>>>> ab02ee63cee32cf24d22046fd28aa77bc2d024ee
