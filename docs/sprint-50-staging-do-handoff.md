# Sprint 50 - DigitalOcean Staging Handoff

This document is the staging deployment handoff for branch `codex/s50-staging-rc`.

## Branch and Repo

- GitHub repo: `enzocienfuegos-cloud/dusk`
- Branch: `codex/s50-staging-rc`

## DigitalOcean Specs

Use these staging-specific manifests:

- [infra/do/backend.staging.app.yaml](/Users/enzocienfuegos/Documents/MandaRion/infra/do/backend.staging.app.yaml)
- [infra/do/portal.staging.app.yaml](/Users/enzocienfuegos/Documents/MandaRion/infra/do/portal.staging.app.yaml)
- [infra/do/web.staging.app.yaml](/Users/enzocienfuegos/Documents/MandaRion/infra/do/web.staging.app.yaml)
- [infra/do/studio.staging.app.yaml](/Users/enzocienfuegos/Documents/MandaRion/infra/do/studio.staging.app.yaml)

## Expected Staging Domains

- `https://portal-staging.duskplatform.co`
- `https://app-staging.duskplatform.co`
- `https://studio-staging.duskplatform.co`
- `https://api-staging.duskplatform.co`
- `https://cdn-staging.duskplatform.co`

## Secrets Required In DO

Backend / API:

- `DATABASE_URL`
- `DATABASE_POOL_URL`
- `SESSION_SECRET`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Worker:

- `DATABASE_URL`
- `DATABASE_POOL_URL`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Migration job:

- `DATABASE_URL`

## Deployment Order

1. Create or update backend from `infra/do/backend.staging.app.yaml`
2. Confirm predeploy migration succeeds
3. Deploy portal from `infra/do/portal.staging.app.yaml`
4. Deploy web from `infra/do/web.staging.app.yaml`
5. Deploy studio from `infra/do/studio.staging.app.yaml`
6. Point DNS / Cloudflare to the new DO ingress endpoints

## Validation

Run locally before DO apply:

```bash
npm run validate:do:staging
npm run build:portal
npm run build:web
npm run build:studio
npm run check:api
```

Run after deploy:

```bash
PORTAL_URL=https://portal-staging.duskplatform.co \
API_URL=https://api-staging.duskplatform.co \
WEB_URL=https://app-staging.duskplatform.co \
node scripts/validate-portal-cutover.mjs

npm run staging:post-deploy:check
```

Current staging status after deployment:

- `staging:post-deploy:check` passes
- `validate-portal-cutover` passes
- `api-staging`, `portal-staging`, `app-staging`, and `studio-staging` are reachable

Important note on acceptance automation:

- [scripts/staging-acceptance-matrix.mjs](/Users/enzocienfuegos/Documents/MandaRion/scripts/staging-acceptance-matrix.mjs) is currently stale versus the deployed `/v1/*` API contract
- failures from that script should not be interpreted as staging downtime
- see [docs/sprint-50-acceptance-matrix-realignment.md](/Users/enzocienfuegos/Documents/MandaRion/docs/sprint-50-acceptance-matrix-realignment.md) for the technical diagnosis and the recommended refactor path

## Notes

- These specs intentionally disable `deploy_on_push` for staging to keep cutover controlled.
- `apps/web` is now a product app, not the identity shell.
- `apps/portal` is the canonical launcher and auth entrypoint.
- `apps/studio` is included as a first-class DO app in staging; this was the missing deploy surface before this handoff.
