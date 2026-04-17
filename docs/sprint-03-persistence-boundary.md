# Sprint 3 - Persistence Boundary

## Goal

Separate business logic from the object-storage persistence implementation so the backend can migrate to a real database without rewriting the entire service layer.

## Completed in this sprint

- extracted the current R2/JSON persistence implementation into `server/data/object-store-repository.mjs`
- moved storage-specific concerns out of `server/store.mjs`:
  - split index keys
  - sidecar prefixes
  - bootstrap/seed logic
  - sidecar hydration and backfill
  - low-level sidecar CRUD helpers
- kept `server/store.mjs` focused on auth, permissions, projects, assets, drafts, and workspace rules
- introduced semantic persistence operations such as:
  - `writeProjectSidecar`
  - `writeProjectStateSidecar`
  - `writeAssetSidecar`
  - `deleteProjectVersionStateSidecar`
- preserved current runtime behavior while improving the backend seam for a future PostgreSQL adapter

## Why this matters

Previously, the service layer and the storage implementation were tightly fused. Any migration away from object storage would have required high-risk edits across the whole server module.

After this sprint, the storage mechanism is still the same, but the coupling is materially lower. The next adapter can implement the same repository surface while keeping most business logic stable.

## Remaining gaps

- the active repository is still object-storage-backed, not relational
- transactions and concurrency guarantees still do not exist
- no repository interface contract tests exist yet
- auth, projects, assets, and drafts still share one broad service module in `server/store.mjs`

## Definition of done for Sprint 3

- storage-specific code is isolated behind a repository module
- backend business logic no longer depends on raw R2 path structure
- future DB migration scope is smaller and more predictable
