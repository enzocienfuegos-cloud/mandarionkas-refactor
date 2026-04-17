# Sprint A3 — Domain Mappers

This sprint separates domain mapping from PostgreSQL repository orchestration.

## Included

- added mapper modules for:
  - `auth`
  - `clients`
  - `projects`
  - `assets`
- moved row-to-domain and domain-to-SQL-params conversion out of the domain repositories
- narrowed the repositories so they now focus on:
  - query selection
  - transaction boundaries
  - result assembly

## Why this matters

Changing a table shape should no longer force service-layer changes or repository-wide search-and-replace.

The conversion logic is now explicit and local to each domain instead of being spread through SQL calls.

## Validation

- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`
