# SMX Studio v4 — Sprint 48

This sprint closes the second half of the refactors started in prior sprints.

## Included
- Action side-effects extracted out of reducer execution (`src/actions/action-effects.ts`)
- `EXECUTE_ACTION` now reduces state purely and runs browser effects after dispatch
- `useStudioStore` now uses `useSyncExternalStoreWithSelector`
- `shallowEqual` wired into production store selection
- Stage uses stable selector composition from `src/core/store/selectors/stage-selectors.ts`
- `StageWidget` memoized to reduce unnecessary rerenders
- `structuredClone()` continues to be preferred for store snapshots/history
- Expanded reducer test coverage for document/scene, timeline/ui and collaboration/metadata slices

## Notes
- This sprint focuses on store/effects/performance/testing hardening.
- Interactive module renderer full extraction is still a follow-up pass; the plugin structure remains in place, but the larger shared module helper file has not been fully eliminated in this sprint.


## Sprint 68 extensibility proof

This milestone validates real extensibility by adding a new `badge` widget plugin end to end:
- widget type added to domain contracts
- widget definition registered through the widget registry
- dedicated stage renderer and export renderer
- smoke coverage proving authoring flow still works after adding the new widget

The goal is to prove that adding a new widget now touches a small, predictable surface instead of requiring cross-cutting edits across the whole editor.


## Sprint 75 — Widget plugin manifest
- Widget registration now uses declarative discovery via `import.meta.glob` over `*.definition.ts` files.
- Builtin widget registration no longer requires hand-maintaining a central array of definitions.
- Plugin manifest entries keep source metadata so extensibility tests can assert uniqueness and registration coverage.


## Source of truth

- All active frontend source code lives under `src/`.
- Root-level legacy mirrors were removed in Sprint 0 to avoid editing the wrong files.
- Use `npm run typecheck` and `npm run build` as the baseline health checks.


## Sprint 8 — Release guardrails
- GitHub Actions CI workflow added under `.github/workflows/ci.yml`
- Clean source release packaging added under `scripts/package-release.mjs`
- Baseline release verification script added under `scripts/run-release-checks.mjs`
- Release docs added under `docs/release/README.md`
- New commands:
  - `npm run release:check`
  - `npm run release:package`
  - `npm run ci:verify`
