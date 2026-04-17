# Sprint 11 - Staging Smoke

## Goal

Make the first PostgreSQL staging cutover verifiable with a repeatable end-to-end smoke flow.

## Completed in this sprint

- added [scripts/staging-platform-smoke.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/staging-platform-smoke.mjs)
- added `npm run staging:platform:smoke`
- extended [.env.staging.example](/Users/enzocienfuegos/Documents/New%20project/.env.staging.example) with smoke credentials and base URL variables

## What the smoke test covers

- `GET /health`
- `GET /readyz`
- `POST /auth/login`
- `GET /auth/session`
- `GET /clients`
- `GET /projects`
- `POST /projects/save`
- `GET /projects/:projectId`
- `GET /projects/:projectId/versions`
- `POST /projects/:projectId/versions`
- `POST /assets`
- `GET /assets/:assetId`
- `POST /assets/:assetId/rename`
- `DELETE /assets/:assetId`
- `DELETE /projects/:projectId`
- `POST /auth/logout`

## Notes

- the smoke intentionally uses a direct-url asset save instead of binary upload so the first cutover validation can focus on metadata, auth and repository behavior
- the smoke script creates and deletes its own project and asset records
- use a dedicated staging smoke user whenever possible

## Recommended staging run order

1. `npm run db:postgres:preflight`
2. `npm run db:postgres:migrate`
3. `env PLATFORM_REPOSITORY_DRIVER=postgres npm run db:postgres:ready`
4. start the API in staging
5. `npm run staging:platform:smoke`

## Definition of done

- staging has a scripted end-to-end validation path
- the first PostgreSQL cutover can be checked without manual clicking through the UI
