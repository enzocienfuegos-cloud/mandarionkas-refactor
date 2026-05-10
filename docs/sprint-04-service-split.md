# Sprint 4 - Service Split

## Goal

Break the backend service monolith into domain-oriented modules without changing the public server contract.

## Completed in this sprint

- extracted shared backend rules to `server/services/shared.mjs`
- extracted auth/session flows to `server/services/auth-service.mjs`
- extracted project/version flows to `server/services/project-service.mjs`
- kept `server/store.mjs` as a facade so `server/server.mjs` did not need a risky route-layer rewrite
- reduced direct coupling between route handlers and one large business-logic file

## Why this matters

This makes the next backend migration steps safer:

- Postgres work can now target one domain at a time
- auth and projects can evolve independently
- test coverage can be added by service area instead of by one broad module

## Current shape

- `server/server.mjs`: HTTP transport and route wiring
- `server/store.mjs`: compatibility facade plus remaining domains
- `server/services/auth-service.mjs`: auth/session rules
- `server/services/project-service.mjs`: projects and versions
- `server/services/shared.mjs`: shared authorization and role helpers
- `server/data/object-store-repository.mjs`: active persistence adapter

## Remaining gaps

- clients/workspaces, assets, and documents still live in `server/store.mjs`
- service-level tests are still missing
- the active repository is still object-storage-backed

## Definition of done for Sprint 4

- backend no longer keeps auth and projects inside one giant service file
- route contract remains unchanged
- further domain splits can proceed incrementally
