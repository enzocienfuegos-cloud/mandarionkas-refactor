# Sprint 14 - Backend Audit Trail

## Goal

Move audit capture from frontend-only intent logging to real backend mutation logging.

## Completed in this sprint

- added backend audit event helpers in [server/services/audit-service.mjs](/Users/enzocienfuegos/Documents/New%20project/server/services/audit-service.mjs)
- added `auditEvents` to the backend persistence shape
- added PostgreSQL schema support for `audit_events`
- added admin inspection endpoint:
  - `GET /admin/audit-events`
- started capturing backend audit events for:
  - session login/logout
  - workspace creation
  - brand creation
  - member invites/additions
  - project create/save/delete/duplicate/archive/restore/owner change
  - project version creation
  - document autosave/manual save/clear
  - asset folder create
  - asset create/rename/delete

## Why this matters

Before this sprint, the repo had UI-level audit intent but not server-side evidence of what actually mutated.

After this sprint, the backend itself records the mutation trail, which is the right foundation for:

- post-cutover diagnosis
- admin inspection
- future compliance/history needs
- eventual worker-driven exports or retention rules

## Notes

- the audit trail currently lives inside the same repository snapshot/bridge model as the rest of the metadata
- this is a strong intermediate step, even though a future production design may move audit ingestion to a more specialized path

## Definition of done

- backend writes audit events for critical mutations
- admin users can inspect audit events through the API
- PostgreSQL compatibility schema persists the audit trail
