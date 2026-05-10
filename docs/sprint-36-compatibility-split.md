# Sprint 36 - Compatibility Split

This sprint reduces the size of the remaining legacy lane by splitting compatibility work into clearer responsibilities.

## What changed

- replaced the single compatibility admin service with two narrower services:
  - `server/services/compatibility-diagnostics-service.mjs`
  - `server/services/compatibility-repair-service.mjs`
- `server/server.mjs` now imports:
  - read-only compatibility flows from the diagnostics service
  - mutation/rebuild compatibility flows from the repair service

## Why it matters

Before this sprint, the remaining legacy lane still grouped together:

- diagnostics
- rebuild
- cleanup/repair

inside one compatibility service.

That made the last transitional surface larger and less explicit than it needed to be.

After this sprint:

- read-only compatibility inspection is separated from repair/mutation behavior
- the legacy lane is smaller, clearer, and easier to retire incrementally
- it is easier to reason about which compatibility endpoints should survive and which are temporary

## Validation

- `node --check server/services/compatibility-diagnostics-service.mjs`
- `node --check server/services/compatibility-repair-service.mjs`
- `node --check server/server.mjs`
- `npm run typecheck`
- `npm run test:architecture`
- `npm run db:postgres:smoke`

## Still transitional

The remaining compatibility surface is now concentrated in:

- `server/data/compatibility-repository.mjs`
- `server/services/compatibility-diagnostics-service.mjs`
- `server/services/compatibility-repair-service.mjs`
- sidecar/index rebuild tooling
- `object-store` compatibility mode

## Next

The next sprint should decide which of these compatibility endpoints are truly long-lived operational tooling and which should be retired once PostgreSQL is fully trusted as the only metadata source.
