# Sprint 18 - Cutover Confidence

## Goal

Add a lightweight backup-and-compare flow so a PostgreSQL cutover can be judged with evidence instead of intuition.

## Completed in this sprint

- added [scripts/export-platform-snapshot.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/export-platform-snapshot.mjs)
- added [scripts/compare-platform-snapshots.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/compare-platform-snapshots.mjs)
- added [scripts/platform-snapshot-smoke.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/platform-snapshot-smoke.mjs)
- added:
  - `npm run platform:snapshot:export`
  - `npm run platform:snapshot:compare`
  - `npm run platform:snapshot:smoke`
- added optional snapshot env vars in [.env.example](/Users/enzocienfuegos/Documents/New%20project/.env.example) and [.env.staging.example](/Users/enzocienfuegos/Documents/New%20project/.env.staging.example)

## Recommended staging sequence

1. with the current driver, run `npm run platform:snapshot:export` and store the file as the pre-cutover baseline
2. run the normal cutover path:
   - `npm run db:postgres:preflight`
   - `npm run db:postgres:migrate`
   - `env PLATFORM_REPOSITORY_DRIVER=postgres npm run db:postgres:ready`
3. deploy/start the API with PostgreSQL enabled
4. run `npm run staging:post-deploy:check`
5. run `npm run staging:platform:smoke`
6. export a second snapshot with PostgreSQL active
7. run `npm run platform:snapshot:compare <baseline.json> <postgres.json>`

## What the snapshot comparison checks

- summary totals for:
  - users
  - clients
  - projects
  - project states
  - versions
  - version states
  - document slots
  - asset folders
  - assets
  - sessions
  - audit events
- identity drift for key domains such as project ids, asset ids, client ids and document slot keys

## Go / No-Go guideline

Go:
- post-deploy check passes
- staging smoke passes
- snapshot comparison is clean or only shows intentional differences like new sessions or new audit events created by the checks themselves

No-go:
- readiness is green but reported driver is not the intended one
- smoke fails in auth, projects, versions or assets
- snapshot comparison shows missing projects, assets, clients or version state

## Definition of done

- cutover can be backed by a before/after repository snapshot
- the repo contains a built-in diff tool for quick operator confidence
- the snapshot flow is smoke-tested in-repo without depending on external staging services
- go/no-go has explicit technical signals instead of gut feel
