# Sprint A4 — Boundary Hardening

This sprint turns the decoupling work into enforced guardrails.

## Included

- added the remaining backend contracts for:
  - `audit`
  - `clients`
  - `documents`
  - `asset-admin`
- moved the remaining services off direct repository imports:
  - `server/services/audit-service.mjs`
  - `server/services/client-service.mjs`
  - `server/services/document-service.mjs`
  - `server/services/asset-admin-service.mjs`
- added backend architecture tests in:
  - `server/testing/backend-architecture.test.mjs`
- extended `npm run test:architecture` so it now covers:
  - frontend layer guardrails
  - backend service/contract/mapper boundaries

## Result

The backend service layer now has an explicit rule:

- services do not import repository implementations directly
- services go through contracts
- contracts do not import services
- mappers stay persistence-only

## Validation

- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`
