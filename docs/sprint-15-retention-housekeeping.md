# Sprint 15 - Retention And Housekeeping

## Goal

Add the first retention-oriented admin controls for audit inspection and stale draft cleanup.

## Completed in this sprint

- extended `GET /admin/audit-events` with filters:
  - `limit`
  - `action`
  - `target`
  - `clientId`
  - `before`
- added cursor-style `nextCursor` support in the audit response
- added stale draft cleanup in [server/services/document-service.mjs](/Users/enzocienfuegos/Documents/New%20project/server/services/document-service.mjs)
- added `POST /admin/maintenance/cleanup-drafts`
- added [scripts/run-draft-cleanup.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/run-draft-cleanup.mjs)
- added `npm run staging:maintenance:cleanup-drafts`
- added `PLATFORM_DRAFT_RETENTION_DAYS`

## Why this matters

Once staging starts accumulating real behavior, two operational needs appear quickly:

- audit inspection needs filters so admins can actually find relevant mutations
- document draft storage needs pruning so old autosaves/manual saves do not accumulate forever

This sprint covers both with simple, explicit controls.

## Definition of done

- admins can inspect audit history with basic filters
- stale drafts can be pruned with a policy-driven retention window
- staging has a scriptable draft housekeeping command
