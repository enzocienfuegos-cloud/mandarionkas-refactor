# Sprint 2 - Auth and Session Cloud-First

## Goal

Move session recovery away from browser-stored bearer tokens and toward a backend-owned session flow.

## Completed in this sprint

- frontend HTTP requests now default to `credentials: include`
- `Authorization` is no longer reconstructed from `localStorage` or `sessionStorage`
- backend now accepts the session token from either bearer auth or the `smx_platform_session` cookie
- login sets an `httpOnly` session cookie
- logout clears the session cookie
- frontend boot now calls `GET /auth/session` to restore the authenticated user from the backend
- platform state no longer rehydrates sensitive session records from browser storage
- backend env now supports:
  - `PLATFORM_ALLOWED_ORIGIN`
  - `PLATFORM_COOKIE_SECURE`

## Why this matters

The previous flow made the browser storage layer part of the trust boundary. That is brittle in multi-environment cloud deployments and makes session behavior depend on local browser state instead of backend authority.

This sprint shifts the system toward a safer model where the backend remains the source of truth for session validity and the frontend restores auth through an explicit runtime handshake.

## Remaining gaps

- the backend still stores session state in the current object-storage-backed persistence layer
- there is no CSRF strategy yet beyond same-site cookie defaults
- session bootstrap currently treats an unavailable API as an unauthenticated state
- tests still need a full dependency install and a cleanup pass to reflect the new cookie-first contract

## Definition of done for Sprint 2

- no sensitive session token is persisted in frontend browser storage
- frontend auth recovery depends on backend session validation
- backend can support cookie-based session continuity across reloads
