# Sprint 13 - Operational Hardening

## Goal

Add the minimum protections and maintenance hooks needed for the first live PostgreSQL-backed staging environment.

## Completed in this sprint

- added in-memory rate limiting in [server/rate-limit.mjs](/Users/enzocienfuegos/Documents/New%20project/server/rate-limit.mjs)
- applied rate limits to:
  - `POST /auth/login`
  - `POST /assets/upload-url`
  - `POST /assets/complete-upload`
- added expired-session cleanup in [server/services/auth-service.mjs](/Users/enzocienfuegos/Documents/New%20project/server/services/auth-service.mjs)
- added `POST /admin/maintenance/cleanup-sessions`
- added [scripts/run-session-cleanup.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/run-session-cleanup.mjs)
- added `npm run staging:maintenance:cleanup-sessions`

## Why this matters

For the first staging cutover, the most likely operational problems are:

- repeated login attempts from one source
- bursty upload preparation/completion traffic
- expired sessions accumulating in metadata storage

This sprint gives the repo a first answer to all three without requiring a worker rollout first.

## Notes

- rate limiting is in-memory and intentionally lightweight
- this is appropriate for the first staging phase, but not the final distributed production design
- session cleanup is explicit and scriptable now, and can later move into a worker or scheduled job

## Definition of done

- sensitive routes have basic throttling
- expired sessions can be cleaned up on demand
- staging has one maintenance command ready for post-cutover operations
