# SMX Platform API bootstrap

## Env

Add this to `.env`:

```env
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=signalmixstudio
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_PUBLIC_BASE=https://pub-<token>.r2.dev
ASSET_SIGNED_URL_TTL_SECONDS=900
PLATFORM_API_HOST=0.0.0.0
PLATFORM_API_PORT=8787
PLATFORM_API_DATA_KEY=platform-api/store.json
```

`PLATFORM_API_DATA_KEY` now points to the API metadata store inside the same Cloudflare R2 bucket, so the backend no longer depends on a local JSON file for runtime persistence.

## Run

```bash
npm install
npm run platform:api
```

## Endpoints

- `GET /health`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /projects`
- `POST /projects/save`
- `GET /projects/:projectId`
- `DELETE /projects/:projectId`
- `GET /projects/:projectId/versions`
- `POST /projects/:projectId/versions`
- `GET /projects/:projectId/versions/:versionId`
- `GET /assets`
- `POST /assets/upload-url`
- `POST /assets/complete-upload`
- `DELETE /assets/:assetId`

## Demo credentials

- `admin@smx.studio` / `demo123`
- `editor@smx.studio` / `demo123`
- `reviewer@smx.studio` / `demo123`
