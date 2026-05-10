# Sprint 16 - Asset Housekeeping

## Goal

Add admin tooling to detect and clean broken asset metadata before it becomes a staging or production operational problem.

## Completed in this sprint

- added asset housekeeping reporting in [server/services/storage-admin-service.mjs](/Users/enzocienfuegos/Documents/New%20project/server/services/storage-admin-service.mjs)
- added `GET /admin/assets/housekeeping`
- added `POST /admin/maintenance/cleanup-assets`
- added [scripts/run-asset-housekeeping.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/run-asset-housekeeping.mjs)
- added `npm run staging:maintenance:assets`
- added `ASSET_HOUSEKEEPING_MODE=report|cleanup` to control whether the script only reports issues or also cleans metadata

## What gets detected

- assets pointing to folders that no longer exist
- assets pointing to clients that no longer exist
- folders whose parent folder no longer exists
- folders whose client no longer exists
- object-storage assets with missing binaries
- object-storage assets with no `storageKey`
- remote-url assets with no usable `src`

## What cleanup does

- removes broken assets whose metadata cannot be recovered automatically
- removes folders whose owning client no longer exists
- repairs folders with invalid parent references by clearing `parentId`
- writes an `asset.housekeeping.cleanup` audit event for traceability

## Definition of done

- admins can inspect asset integrity issues through the API
- staging has a scriptable asset housekeeping command
- cleanup is explicit, auditable and separate from the report-only path
