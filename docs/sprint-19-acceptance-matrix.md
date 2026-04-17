# Sprint 19 - Acceptance Matrix

## Goal

Turn cutover verification into a domain-based acceptance matrix instead of relying on one generic smoke test.

## Completed in this sprint

- added [scripts/staging-acceptance-matrix.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/staging-acceptance-matrix.mjs)
- added `npm run staging:acceptance:matrix`
- added `STAGING_ACCEPTANCE_DOMAINS` to env examples so operators can run only a subset of domains when debugging
- added `STAGING_ACCEPTANCE_INCLUDE_UPLOAD_COMPLETION` so the assets domain can optionally exercise signed upload plus `/assets/complete-upload`

## Domains covered

- `platform`
  - `GET /health`
  - `GET /readyz`
  - `GET /version`
  - `GET /observability`
- `auth_session`
  - `POST /auth/login`
  - `GET /auth/session`
- `clients_workspaces`
  - `GET /clients`
  - `POST /clients/active`
- `projects_versions`
  - `GET /projects`
  - `POST /projects/save`
  - `GET /projects/:id`
  - `GET /projects/:id/versions`
  - `POST /projects/:id/versions`
  - `GET /projects/:id/versions/:versionId`
  - `DELETE /projects/:id`
- `drafts_documents`
  - `GET /documents/autosave/exists`
  - `POST /documents/autosave`
  - `GET /documents/autosave`
  - `DELETE /documents/autosave`
  - `GET /documents/manual-save/exists`
  - `POST /documents/manual-save`
  - `GET /documents/manual-save`
  - `DELETE /documents/manual-save`
- `assets_uploads`
  - `GET /assets`
  - `POST /assets`
  - `GET /assets/:id`
  - `POST /assets/:id/rename`
  - `POST /assets/upload-url`
  - optionally: direct `PUT` to the signed upload URL plus `POST /assets/complete-upload`
  - `DELETE /assets/:id`
- `admin_observability_audit`
  - `GET /admin/audit-events`
  - `GET /admin/assets/housekeeping`
  - `GET /admin/storage/diagnostics`

## Safety model

- the acceptance runner cleans up the project and asset records it creates
- the document coverage now exercises both `autosave` and `manual-save` because both have explicit delete routes
- the runner avoids mutating client membership, invitations and brand topology
- binary upload completion can be exercised when `STAGING_ACCEPTANCE_INCLUDE_UPLOAD_COMPLETION=true`, because the runner uploads a tiny object and cleans it up with `purge=1`

## Recommended cutover order

1. `npm run db:postgres:preflight`
2. `npm run db:postgres:migrate`
3. `env PLATFORM_REPOSITORY_DRIVER=postgres npm run db:postgres:ready`
4. deploy/start the API
5. `npm run staging:post-deploy:check`
6. `npm run staging:acceptance:matrix`
7. `npm run staging:platform:smoke`
8. snapshot export/compare if this is a real cutover window

## Go / No-Go guideline

Go:
- all acceptance domains pass
- failures, if any, are isolated to intentionally skipped/non-automated areas
- `readyz`, `version` and `observability` all report the intended repository driver

No-go:
- one or more core domains fail:
  - `auth_session`
  - `projects_versions`
  - `assets_uploads`
  - `drafts_documents`
- admin diagnostics show obvious repository drift after a supposedly successful switch

## Definition of done

- staging verification is grouped by domain instead of a single undifferentiated smoke
- operators can rerun only the failing domain set while debugging
- the repo now has an explicit acceptance layer between post-deploy checks and full manual QA
