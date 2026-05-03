# Dusk — Sprint 48

This is Dusk and  closes the second half of the refactors started in prior sprints.

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


## Runtime configuration

- Frontend API origins are configured through Vite env vars, not browser storage.
- Set `VITE_API_BASE_URL` when all API traffic shares one backend origin.
- Use service-specific overrides only when cutover requires split origins:
  - `VITE_PLATFORM_API_BASE_URL`
  - `VITE_PROJECT_API_BASE_URL`
  - `VITE_DOCUMENT_API_BASE_URL`
  - `VITE_ASSET_API_BASE_URL`
- See `.env.example` and [docs/sprint-01-cloud-baseline.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-01-cloud-baseline.md).

## Setup local (web app)

```bash
cp apps/web/.env.local.example apps/web/.env.local
# Editar apps/web/.env.local con los valores de staging o local
npm run dev:web
```

Sin este paso, los snippets de tags generados en el UI apuntarán al host
del browser en lugar del API correcto.

## Session model

- Frontend API requests use `credentials: include`.
- Session recovery happens through `GET /auth/session`, not through browser-stored bearer tokens.
- Backend deployments should set `PLATFORM_ALLOWED_ORIGIN` and `PLATFORM_COOKIE_SECURE` appropriately for the target environment.
- See [docs/sprint-02-auth-session-cloud.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-02-auth-session-cloud.md).

## Backend persistence

- PostgreSQL is now the only supported metadata persistence driver.
- Storage implementation details now live under `server/data/`.
- See [docs/sprint-03-persistence-boundary.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-03-persistence-boundary.md).
- `server/data/repository.mjs` is now the single persistence entrypoint for backend services.
- `PLATFORM_REPOSITORY_DRIVER=postgres` is the only supported runtime mode.
- `server/data/postgres-repository.mjs` now implements a transactional snapshot bridge for PostgreSQL-backed metadata.
- `server/data/postgres-client.mjs` provides the database execution boundary and supports either:
  - an installed `pg` dependency
  - or an injected executor via `globalThis.__SMX_PLATFORM_PG_EXECUTE__`
- `server/data/postgres-schema.sql` defines the initial metadata tables for users, sessions, clients, projects, versions, drafts and assets.
- the schema file targets `public` by default; apply the same DDL to your target schema if `PLATFORM_POSTGRES_SCHEMA` is different.
- `server/data/postgres-migrations/` now contains the ordered SQL migrations for PostgreSQL activation.
- project persistence has started moving to explicit domain methods instead of full snapshot rewrites.
- `server/services/project-service.mjs` now persists project CRUD/version flows through repository domain methods.
- PostgreSQL-backed project writes now hit `projects`, `project_states`, `project_versions` and `project_version_states` directly.
- auth/session writes now persist directly through repository domain methods instead of `writeDb(db)`.
- client/workspace writes now persist directly through repository domain methods instead of `writeDb(db)`.
- audit reads now resolve through repository domain methods.
- document draft flows now persist through repository domain methods.
- asset and asset-folder flows now persist through repository domain methods.
- authenticated session resolution now hydrates a minimal session context instead of the full backend snapshot.
- `server/server.mjs` now imports service modules directly; the old `server/store.mjs` facade has been removed.
- Sprint 38 removed the remaining compatibility lane, the `object-store` runtime path and the compatibility admin routes.
- `npm run db:postgres:migrate` applies pending PostgreSQL migrations.
- `npm run db:postgres:ready` checks connectivity/readiness through the active repository driver.
- `npm run db:postgres:smoke` validates the PostgreSQL adapter locally against an in-memory `pg-mem` instance.
- `npm run db:postgres:preflight` checks whether a staging cutover env is complete before switching drivers.
- `npm run platform:snapshot:export` exports the current repository snapshot for backup/comparison before or after a cutover.
- `npm run platform:snapshot:compare` compares two exported snapshots and fails if summary counts or key identities drift.
- `npm run platform:snapshot:smoke` validates the snapshot export/compare flow against an in-memory PostgreSQL adapter.
- `npm run production:readiness:report` summarizes cutover config, automated coverage and known production gaps.
- `npm run production:readiness:evaluate` turns the readiness report into an executive `go / conditional / no-go` evaluation with next actions.
- `npm run staging:cutover:plan` prints the ordered cutover sequence for staging based on the current readiness state.
- `npm run staging:cutover:checklist` prints a markdown-style operator checklist for the actual cutover window.
- `npm run staging:env:check` validates that `.env.staging` no longer contains placeholders and has production-like values.
- `npm run staging:acceptance:matrix` runs grouped domain acceptance checks for platform, auth, clients, projects, drafts, assets and admin endpoints.
- `npm run staging:post-deploy:check` validates `/health`, `/readyz`, `/version` and `/observability` after deploy and asserts the active repository driver.
- `npm run staging:upload-completion:rehearsal` validates signed upload, `/assets/complete-upload`, asset fetch and binary cleanup end-to-end.
- `npm run staging:tenant-mutations:rehearsal` validates workspace creation, brand creation and invite flows in a smoke-only tenant configuration.
- `npm run staging:platform:smoke` runs the first end-to-end staging smoke against the live API.
- `npm run staging:maintenance:cleanup-sessions` removes expired sessions through the admin maintenance route.
- `npm run staging:maintenance:cleanup-drafts` prunes stale document drafts through the admin maintenance route.
- `npm run staging:maintenance:assets` inspects or cleans broken asset metadata through the admin asset housekeeping routes.
- `GET /observability` exposes a lightweight JSON snapshot for post-cutover verification.
- `GET /admin/audit-events` exposes backend audit history for admins.
- `GET /admin/assets/housekeeping` exposes orphaned/misaligned asset metadata for admins.
- See [docs/sprint-07-repository-contract.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-07-repository-contract.md).
- See [docs/sprint-08-postgres-bridge.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-08-postgres-bridge.md).
- See [docs/sprint-09-postgres-activation.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-09-postgres-activation.md).
- See [docs/sprint-10-staging-cutover.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-10-staging-cutover.md).
- See [docs/sprint-11-staging-smoke.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-11-staging-smoke.md).
- See [docs/sprint-12-observability.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-12-observability.md).
- See [docs/sprint-13-hardening.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-13-hardening.md).
- See [docs/sprint-14-backend-audit.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-14-backend-audit.md).
- See [docs/sprint-15-retention-housekeeping.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-15-retention-housekeeping.md).
- See [docs/sprint-16-asset-housekeeping.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-16-asset-housekeeping.md).
- See [docs/sprint-17-operational-cutover-pack.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-17-operational-cutover-pack.md).
- See [docs/sprint-18-cutover-confidence.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-18-cutover-confidence.md).
- See [docs/sprint-19-acceptance-matrix.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-19-acceptance-matrix.md).
- See [docs/sprint-20-production-readiness-gaps.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-20-production-readiness-gaps.md).
- See [docs/sprint-22-upload-completion-rehearsal.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-22-upload-completion-rehearsal.md).
- See [docs/sprint-23-tenant-mutations-rehearsal.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-23-tenant-mutations-rehearsal.md).
- See [docs/sprint-24-production-readiness-evaluation.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-24-production-readiness-evaluation.md).
- See [docs/sprint-25-staging-cutover-plan.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-25-staging-cutover-plan.md).
- See [docs/sprint-26-staging-cutover-checklist.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-26-staging-cutover-checklist.md).
- See [docs/sprint-27-staging-env-readiness.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-27-staging-env-readiness.md).
- See [docs/sprint-28-project-domain-repository.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-28-project-domain-repository.md).
- See [docs/sprint-29-auth-client-domain-repository.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-29-auth-client-domain-repository.md).
- See [docs/sprint-30-audit-documents-assets-domain-repository.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-30-audit-documents-assets-domain-repository.md).
- See [docs/sprint-31-session-context-slimming.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-31-session-context-slimming.md).
- See [docs/sprint-32-store-facade-collapse.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-32-store-facade-collapse.md).
- See [docs/sprint-38-compatibility-removal.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-38-compatibility-removal.md).

## Backend services

- Auth/session logic now lives in `server/services/auth-service.mjs`.
- Project/version logic now lives in `server/services/project-service.mjs`.
- Asset logic now lives in `server/services/asset-service.mjs`.
- Asset housekeeping/admin cleanup now lives in `server/services/asset-admin-service.mjs`.
- Document draft/autosave logic now lives in `server/services/document-service.mjs`.
- Workspace/client logic now lives in `server/services/client-service.mjs`.
- Shared backend authorization helpers now live in `server/services/shared.mjs`.
- See [docs/sprint-04-service-split.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-04-service-split.md).
- See [docs/sprint-05-assets-documents-split.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-05-assets-documents-split.md).
- See [docs/sprint-06-residual-monolith-closure.md](/Users/enzocienfuegos/Documents/New%20project/docs/sprint-06-residual-monolith-closure.md).


## Sprint 8 — Release guardrails
- GitHub Actions CI workflow added under `.github/workflows/ci.yml`
- Clean source release packaging added under `scripts/package-release.mjs`
- Baseline release verification script added under `scripts/run-release-checks.mjs`
- Release docs added under `docs/release/README.md`
- New commands:
  - `npm run release:check`
  - `npm run release:package`
  - `npm run ci:verify`
