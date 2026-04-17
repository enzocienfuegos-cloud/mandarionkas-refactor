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
