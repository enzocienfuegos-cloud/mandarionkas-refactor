# Environment Matrix

## Web (`apps/web`)

Required:

- `VITE_API_BASE_URL`
- `VITE_STUDIO_URL`

Recommended:

- `VITE_ASSETS_BASE_URL`
- `VITE_APP_ENV`

## Studio (`apps/studio`)

Required:

- `VITE_API_BASE_URL`

Recommended:

- `VITE_ASSETS_BASE_URL`
- `VITE_APP_ENV`
- `VITE_PUBLIC_BASE_PATH`

Defaults:

- `VITE_PUBLIC_BASE_PATH=/`

Use `/studio/` only for temporary path-prefix deployments.

## API (`apps/api`)

Required:

- `DATABASE_URL`
- `SESSION_SECRET`
- `HOST`
- `PORT`
- `CORS_ORIGIN`

Recommended:

- `NODE_ENV`
- `DB_SSL`
- `DB_SSL_REJECT_UNAUTHORIZED`
- `SESSION_COOKIE_DOMAIN`
- `SESSION_COOKIE_SAME_SITE`
- `LOG_LEVEL`
- `MAX_UPLOAD_BYTES`

## Operational notes

- `CORS_ORIGIN` supports a comma-separated allow list.
- `SESSION_COOKIE_DOMAIN` is optional. Keep it empty unless the deployment explicitly needs a shared cookie domain override.
- `DB_SSL=true` and `DB_SSL_REJECT_UNAUTHORIZED=false` are required for the current DigitalOcean managed Postgres staging setup.
