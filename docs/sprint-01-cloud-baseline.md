# Sprint 1 - Cloud Baseline

## Goal

Remove client-local endpoint configuration and establish a single cloud runtime contract for the web app.

## Why this sprint exists

The repo documentation already describes a cloud-first architecture, but the frontend still depended on browser storage to discover API origins. That makes deployments non-deterministic and couples runtime behavior to whichever browser last wrote local state.

## Completed in this sprint

- API base resolution is now centralized in `src/shared/runtime/api-base.ts`
- platform, repository, and asset upload clients now resolve endpoints from Vite env vars instead of `localStorage`
- the shared default is `VITE_API_BASE_URL`
- service-specific overrides are supported for phased cutovers:
  - `VITE_PLATFORM_API_BASE_URL`
  - `VITE_PROJECT_API_BASE_URL`
  - `VITE_DOCUMENT_API_BASE_URL`
  - `VITE_ASSET_API_BASE_URL`
- repository tests were updated to assert env-driven resolution instead of browser storage mutation
- `.env.example` was added so the runtime contract is visible in-repo

## Remaining work before Sprint 1 is fully closed

- remove token/session reliance on browser storage in frontend auth flows
- replace `index.php` proxy assumptions with deployment-native ingress/reverse proxy config
- install dependencies and restore CI-verifiable health checks in this workspace
- update legacy docs that still overstate backend readiness versus the code currently in `server/`

## Definition of done for Sprint 1

- web runtime endpoint configuration is deterministic per environment
- frontend deploys no longer require manual browser-side setup
- cloud/staging/prod can each provide their own API base through env only

## Risks still open

- document persistence still contains local fallback behavior
- auth transport still uses browser-stored session data
- backend persistence remains object-storage-centric in the checked-in server implementation
