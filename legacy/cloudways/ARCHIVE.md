# legacy/cloudways — Archived

**Status: ARCHIVED — S47**

This directory contains the SMX Studio v2.x codebase that ran on Cloudways
(PHP + Redis + PostgreSQL). It is preserved here for audit and migration
reference only.

## What's here

| Path | Description |
|---|---|
| `index.php` | Legacy PHP entry point — no longer deployed |
| `compiled-assets/` | Minified JS/CSS from the last Cloudways build |
| `server/` | Node.js ESM modules used by the legacy API layer |
| `server/contracts/` | Repository interfaces (never implemented in this tree) |
| `server/data/` | Legacy PostgreSQL repository implementations |
| `scripts/` | Release packaging scripts (Cloudways deploy flow) |
| `SMOKE_TEST_REPORT.txt` | Smoke report from Sprint 3 (April 2026) — last verified run |
| `docs-platform-api.md` | Legacy API surface documentation |

## Why it's still here

- Historical reference for data shape decisions in `packages/db` migrations
- `packages/db/src/legacy-import.mjs` reads the legacy data format when
  importing old Cloudways workspaces — it does NOT import from this directory;
  the shared data structures are documented here for reference
- The legacy PostgreSQL schema (`server/data/postgres-schema.sql`) was used
  to derive migrations 0001–0006 in the new platform

## Safe to delete?

Yes — after confirming:
1. All active workspaces have been migrated via `npm run db:import:legacy`
2. No live traffic is routing to Cloudways (verify via Cloudflare analytics)
3. The Cloudways environment has been decommissioned

**Delete command:**
```bash
git rm -r legacy/cloudways/
git commit -m "chore: remove Cloudways legacy archive post-migration"
```

## Last known live traffic

Per `SMOKE_TEST_REPORT.txt`: Last smoke run April 12, 2026 (Sprint 3).
DNS was cut over to DigitalOcean in S43 — Cloudways no longer receives traffic.
