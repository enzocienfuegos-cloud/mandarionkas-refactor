<<<<<<< HEAD
# Sprint 18 — Platform API contracts

## Auth
- `POST /auth/login`
- `POST /auth/logout`

## Projects
- `GET /projects`
- `POST /projects/save`
- `GET /projects/:projectId`
- `DELETE /projects/:projectId`
- `GET /projects/:projectId/versions`
- `POST /projects/:projectId/versions`
- `GET /projects/:projectId/versions/:versionId`

## Assets
- `GET /assets`
- `POST /assets`
- `GET /assets/:assetId`
- `DELETE /assets/:assetId`
- `POST /assets/:assetId/rename`
- `POST /assets/upload-url`
- `POST /assets/complete-upload`

## Notes
- Frontend now accepts both the new envelope format and legacy raw responses.
- Neutral DTOs live in `src/types/contracts` so contracts stay decoupled from UI/platform/editor layers.
- Platform login UI now supports async auth providers without breaking the demo/local flow.
=======
# Platform API contracts — target v1

## Health

- `GET /healthz`
- `GET /readyz`
- `GET /version`

`/readyz` now performs a real database reachability check and returns `503` when the runtime is not actually ready for traffic.

## Auth

Implemented in Sprint 2, hardened in Sprint 6:

- `GET /v1/auth/session`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `GET /v1/auth/health`

Auth responses are cookie-backed and return the current user, permissions, active workspace/client id, and the workspace list visible to that session.
Login is rate-limited in-memory per source IP.

## Workspaces

Implemented in Sprint 2:

- `GET /v1/workspaces`
- `POST /v1/workspaces`

Planned next:

- `GET /v1/workspaces/:workspaceId`
- `PATCH /v1/workspaces/:workspaceId`
- `POST /v1/workspaces/:workspaceId/invites`
- `POST /v1/workspaces/:workspaceId/brands`

## Compatibility routes during migration

The current frontend still speaks `clients` in a few places.
These compatibility routes remain temporarily and are backed by the same PostgreSQL data:

- `GET /v1/clients`
- `POST /v1/clients`
- `POST /v1/clients/active`
- `POST /v1/clients/:clientId/brands`
- `POST /v1/clients/:clientId/invites`

They now return deprecation headers:

- `Deprecation: true`
- `Sunset: Wed, 30 Sep 2026 23:59:59 GMT`
- `Link: </v1/workspaces>; rel="successor-version"`

## Projects

Implemented in Sprint 3:

- `GET /v1/projects`
- `POST /v1/projects/save`
- `GET /v1/projects/:projectId`
- `DELETE /v1/projects/:projectId`
- `POST /v1/projects/:projectId/duplicate`
- `POST /v1/projects/:projectId/archive`
- `POST /v1/projects/:projectId/restore`
- `POST /v1/projects/:projectId/owner`

## Project versions

Implemented in Sprint 3:

- `GET /v1/projects/:projectId/versions`
- `POST /v1/projects/:projectId/versions`
- `GET /v1/projects/:projectId/versions/:versionId`

## Draft persistence

Implemented in Sprint 3:

- `GET /v1/documents/autosave`
- `POST /v1/documents/autosave`
- `DELETE /v1/documents/autosave`
- `GET /v1/documents/autosave/exists`
- `GET /v1/documents/manual-save`
- `POST /v1/documents/manual-save`
- `GET /v1/documents/manual-save/exists`

## Assets

Implemented in Sprint 4, hardened in Sprint 6:

- `GET /v1/assets`
- `POST /v1/assets` _(direct URL / remote metadata save)_
- `GET /v1/assets/folders`
- `POST /v1/assets/folders`
- `POST /v1/assets/uploads`
- `POST /v1/assets/uploads/:uploadId/complete`
- `POST /v1/assets/upload-url` _(temporary compatibility route)_
- `POST /v1/assets/complete-upload` _(temporary compatibility route)_
- `GET /v1/assets/:assetId`
- `DELETE /v1/assets/:assetId`
- `POST /v1/assets/:assetId/rename`
- `GET /v1/assets/health`
- `POST /v1/assets/health`

Upload prepare and complete flows are rate-limited in-memory per source IP.

## Admin

Compatibility stubs:

- `GET /v1/admin/storage/diagnostics`
- `POST /v1/admin/storage/rebuild`

Runtime admin surface:

- `GET /v1/admin/audit-events`
>>>>>>> ab02ee63cee32cf24d22046fd28aa77bc2d024ee
