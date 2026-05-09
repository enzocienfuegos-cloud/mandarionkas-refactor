# Release Checklist

## Before Opening A PR

- `npm run release:readiness -w @smx/studio`
- `npm run test -w @smx/studio`
- `npm run build -w @smx/studio`
- `npm run audit:visual-debt -w @smx/studio`
- `npm run test:visual -w @smx/studio`

## If The Change Touches Export

- verify target channel behavior in the editor
- verify export registry coverage exists
- verify portable export remains coherent
- verify preflight warnings do not regress silently

## If The Change Touches A Widget

- confirm defaults are stable
- confirm inspector tabs stay coherent
- confirm selection and stage rendering still work
- add at least one focused unit or parity test

## If The Change Touches Shell Or Inspector

- confirm login, hub, editor, and inspector baselines still pass
- confirm `files over threshold` does not regress
- avoid introducing inline styles or new mega-files

## Signoff Rule

If a change affects stage, export, or product-critical surfaces and it does not pass both logical tests and visual baselines, it is not ready for release.

## Dashboard Output

`npm run release:readiness -w @smx/studio` writes a markdown snapshot under `artifacts/release-readiness/studio/` so the current release state is easy to review or attach to a handoff.
