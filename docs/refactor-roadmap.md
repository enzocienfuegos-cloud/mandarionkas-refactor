# Refactor roadmap

## Sprint 1 - repo and infrastructure baseline

Completed:

- monorepo split completed
- Cloudways runtime isolated in `legacy/`
- DO App Platform specs added
- PostgreSQL schema drafted
- API scaffold bootstrapped
- frontend now points at `VITE_API_BASE_URL`

## Sprint 2 - auth + workspaces

Completed:

- hashed passwords via scrypt helpers
- signed httpOnly session cookies
- `users`, `sessions`, `workspaces`, `workspace_members`, `workspace_invites`, `brands`
- PostgreSQL-backed login and session recovery
- workspace creation, switching, brand creation and invite flows
- demo seed script for `admin@smx.studio`, `editor@smx.studio`, `reviewer@smx.studio`

## Sprint 3 - projects + autosave + versions

Completed:

- PostgreSQL-backed `projects`, `project_documents`, `project_versions`
- cloud-only `user_document_drafts` for autosave/manual snapshots
- real API routes for project list, load, save, delete, duplicate, archive, restore and owner changes
- version list/save/load over PostgreSQL JSONB snapshots
- removal of the silent browser-storage fallback from document persistence in API mode

## Sprint 4 - assets + R2 direct uploads

Completed:

- PostgreSQL-backed `asset_folders`, `asset_upload_sessions` and `assets` routes
- create/list folders, list/get/delete/rename assets
- prepare upload -> direct R2 upload -> complete upload contract in the new API
- direct URL / remote asset saves persist metadata in PostgreSQL

## Sprint 5 - legacy importer

Completed:

- one-shot legacy importer for split JSON, single `store.json`, or direct legacy R2 reads
- importer hashes legacy passwords, skips legacy sessions and writes JSON/Markdown reports
- importer reconciles sidecars with split JSON before building the PostgreSQL import plan
- importer optionally verifies imported asset objects against R2

## Sprint 6 - hardening and cutover readiness

Completed:

- `/readyz` now verifies real DB reachability and returns `503` when the API is not actually ready
- rate limiting added for login and upload endpoints
- audit logging added for workspace, project, draft and asset mutations
- audit inspection endpoint added for admins
- compatibility `clients` routes now return deprecation headers and sunset metadata
- maintenance worker now expires stale upload sessions, revokes expired sessions and prunes old drafts
- smoke-check script added for post-deploy verification
- DO backend spec extended with worker maintenance env

## Final production cutover checklist

Still to execute in the target environment:

- run migrations against Managed PostgreSQL
- run legacy import in dry-run, review report, then apply
- seed or create initial admin users if importer is not used
- deploy `smx-studio-web` and `smx-studio-backend`
- verify `readyz` is green from the App Platform origin
- run `npm run smoke:api` against the Cloudflare-fronted `api.<domain>`
- switch Cloudflare DNS to the DO origins
- validate login, workspace switch, project save/load, asset upload and manual/autosave flows
- monitor audit events and worker maintenance logs for the first 24h
- retire compatibility routes after the frontend no longer calls `clients`
