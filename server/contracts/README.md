# Backend Domain Contracts

These modules make service ownership explicit.

- `auth-repository.mjs`
  - session and user persistence needed by auth/session flows
- `audit-repository.mjs`
  - audit persistence and audit inspection
- `client-repository.mjs`
  - workspace/client persistence plus the small auth crossovers needed by client flows
- `document-repository.mjs`
  - document-slot persistence and document audit append
- `project-repository.mjs`
  - project, version and supporting lookup persistence needed by project flows
- `asset-repository.mjs`
  - asset and folder persistence needed by asset flows
- `asset-admin-repository.mjs`
  - admin asset housekeeping persistence and supporting client lookups

Services should import the narrowest contract they need instead of the full repository entrypoint.
