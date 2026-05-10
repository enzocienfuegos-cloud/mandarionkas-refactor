# Sprint 25 - Staging Cutover Plan

## Goal

Turn the readiness verdict into a concrete ordered sequence for the actual staging cutover.

## Completed in this sprint

- added [scripts/staging-cutover-plan.mjs](/Users/enzocienfuegos/Documents/New%20project/scripts/staging-cutover-plan.mjs)
- added `npm run staging:cutover:plan`

## What the plan does

- reads the current production/staging readiness state
- emits an ordered list of cutover steps
- marks which steps are required vs conditional
- fails fast with `no-go` when critical configuration is still missing

## Typical sequence

1. readiness evaluation
2. PostgreSQL preflight
3. PostgreSQL migrations
4. PostgreSQL readiness
5. deploy/restart staging on `postgres`
6. post-deploy check
7. acceptance matrix
8. staging smoke
9. upload completion rehearsal
10. tenant mutation rehearsal when smoke-only tenant config exists
11. snapshot export/compare

## Definition of done

- staging cutover is no longer described only across multiple docs
- operators can print one ordered plan before a real cutover window
- the repo now has a final bridge from readiness analysis to execution
