# Sprint 22 - Upload Completion Rehearsal

## Goal

Make binary upload completion a first-class operational check instead of only an optional branch inside the acceptance matrix.

## Completed in this sprint

- added [scripts/staging-upload-completion-rehearsal.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/staging-upload-completion-rehearsal.mjs)
- added `npm run staging:upload-completion:rehearsal`
- updated the production readiness report so upload completion is no longer treated as an open operational gap

## What the rehearsal checks

- `POST /auth/login`
- `POST /assets/upload-url`
- direct `PUT` to the signed upload URL
- `POST /assets/complete-upload`
- `GET /assets/:assetId`
- `DELETE /assets/:assetId?purge=1`
- `POST /auth/logout`

## Why this matters

Upload completion is one of the few flows that depends on:

- application auth/session
- signed URL generation
- object storage write success
- metadata persistence
- cleanup of both metadata and binary data

That makes it a disproportionately valuable production-readiness check.

## Definition of done

- upload completion can be validated end-to-end with one command
- readiness no longer has to treat upload completion as an unresolved warning
- the repo now has a dedicated rehearsal for the binary path, separate from the general acceptance matrix
