# Staging Deployment Runbook

This monorepo deploys as three independently addressable applications:

- `apps/web` → `app-staging.duskplatform.co`
- `apps/api` → `api-staging.duskplatform.co`
- `apps/studio` → `studio-staging.duskplatform.co`

## DigitalOcean component settings

### Web (`smx-studio-web-staging` static site)

- Source directory: `/apps/web`
- Build command: `npm run build`
- Output directory: `dist`

Environment variables:

- `VITE_API_BASE_URL=https://api-staging.duskplatform.co`
- `VITE_ASSETS_BASE_URL=https://app-staging.duskplatform.co`
- `VITE_APP_ENV=staging`
- `VITE_STUDIO_URL=https://studio-staging.duskplatform.co`

Routing:

- domain `app-staging.duskplatform.co`
- route `/`
- assets route `/assets`

### API (`smx-studio-web-staging` app/service)

- Build command: `None`
- Run command: `cd /workspace/apps/api && npm start`

Environment variables:

- `DATABASE_URL`
- `DB_SSL=true`
- `DB_SSL_REJECT_UNAUTHORIZED=false`
- `SESSION_SECRET`
- `CORS_ORIGIN=https://app-staging.duskplatform.co,https://studio-staging.duskplatform.co`
- `HOST=0.0.0.0`
- `PORT=8080`
- `NODE_ENV=production`
- `SESSION_COOKIE_DOMAIN=` (leave empty unless a cross-subdomain cookie override is explicitly required)
- `SESSION_COOKIE_SAME_SITE=lax`

Post-deploy operations:

- `cd /workspace && npm run migrate`
- `cd /workspace && npm run seed`

### Studio (`mandarionkas-refactor` static site)

- Source directory: `/`
- Build command: `cd /workspace && corepack pnpm --filter @smx/studio build`
- Output directory: `apps/studio/dist`

Environment variables:

- `VITE_API_BASE_URL=https://api-staging.duskplatform.co`
- `VITE_ASSETS_BASE_URL=https://app-staging.duskplatform.co`
- `VITE_APP_ENV=staging`
- `VITE_PUBLIC_BASE_PATH=/`

Routing:

- domain `studio-staging.duskplatform.co`
- domain-specific root route with an empty path

## Acceptance checklist

After every staging deploy verify:

1. `https://app-staging.duskplatform.co` loads.
2. `https://studio-staging.duskplatform.co` loads.
3. Studio HTML references `/assets/...`, not `/studio/assets/...`.
4. `https://api-staging.duskplatform.co/health` returns `200`.
5. Login works with the seeded demo user.
6. `Open Studio` in the web shell opens the studio subdomain.
7. Refreshing a studio route does not break asset loading.

## Smoke test

Run:

```bash
cd /tmp/sprint-51-final-git
npm run smoke:staging
```

For a full cross-app smoke that verifies login and studio session restore, run:

```bash
STAGING_SMOKE_EMAIL=admin@smxstudio.io \
STAGING_SMOKE_PASSWORD='Admin1234!' \
npm run smoke:staging
```

That authenticated smoke validates:
- web HTML and assets
- studio HTML and assets
- API health
- login against `/v1/auth/login`
- studio bootstrap against `/v1/auth/session`
- authenticated access to `/v1/projects`
- authenticated access to `/v1/assets`

For a write-path smoke in staging, add `STAGING_SMOKE_WRITE=true`:

```bash
STAGING_SMOKE_EMAIL=admin@smxstudio.io \
STAGING_SMOKE_PASSWORD='Admin1234!' \
STAGING_SMOKE_WRITE=true \
npm run smoke:staging
```

That flow will:
- create a smoke project
- save a project version
- create an asset folder
- create a remote asset record
- move the asset into the folder
- clean up the asset, folder, and project

Optional overrides:

- `STAGING_WEB_URL`
- `STAGING_API_URL`
- `STAGING_STUDIO_URL`
