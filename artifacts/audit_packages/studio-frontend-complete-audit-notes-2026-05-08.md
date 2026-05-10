# Studio Frontend Complete Audit Notes

Date: 2026-05-08
Repo: `MandaRion`
Scope: `apps/studio`

## Audit inputs used

- `/Users/enzocienfuegos/Documents/MandaRion/artifacts/studio_front_audit_2026-05-07.md`
- `/Users/enzocienfuegos/Downloads/CODEX-DELIVERABLE-AUDIT-2026-05-08.md`
- `/Users/enzocienfuegos/Downloads/files/STUDIO-CODEX-IMPLEMENTATION-PLAN-2026-05-08.md`
- `/Users/enzocienfuegos/Downloads/files/STUDIO-UX-AUDIT-2026-05-08.md`

## What was implemented

### 1. Styling foundation and guardrails

- Replaced the old monolithic shared stylesheet split with domain CSS under `src/shared/styles/`.
- Converted `src/shared/layout.css` into a shim entrypoint.
- Expanded `src/shared/theme.css` into a real token system with:
  - semantic surfaces
  - semantic borders
  - semantic text roles
  - gradients
  - shadows
  - motion tokens
  - z-index aliases
- Added CSS guardrails with `.stylelintrc.cjs`.
- Wired `lint:css` into the Studio build.

### 2. Shared UI primitives and icon system

- Added shared UI primitives under `src/shared/ui/`:
  - `Button.tsx`
  - `IconButton.tsx`
  - `Tabs.tsx`
  - `Tile.tsx`
  - `SegmentedControl.tsx`
  - `Tooltip.tsx`
  - `ToastProvider.tsx`
  - `icons.tsx`
- Migrated major shell, inspector and timeline surfaces to the new primitives.
- Replaced legacy glyphs and ad hoc icon usage with a centralized Lucide-based icon system.

### 3. Shell, layout and interaction improvements

- Added persistent shell layout state.
- Made the right inspector resizable.
- Added top bar center content, cleaner action grouping, dirty state affordances and tooltip coverage.
- Added toasts for top bar actions and secondary document-inspector flows.

### 4. Inspector and registry work

- Refactored the document inspector to a registry-driven architecture.
- Added built-in registration plumbing for document inspector sections.
- Reduced hardcoded panel orchestration in `DocumentInspectorPanel.tsx`.

### 5. Capability model

- Added widget capability metadata to widget definitions.
- Replaced asset/media compatibility whitelists in stage, shell and inspector consumers with capability-driven checks.

### 6. Widget library and stage authoring

- Added declarative widget thumbnails for the widget library.
- Added wireframe rendering mode for stage editing with persisted preferences.
- Cleaned placeholder glyphs and normalized render icons for multiple widgets and modules.

### 7. Story flow and layers

- Added `StoryFlowCanvas` with persisted `list/canvas` preference.
- Added scene canvas positioning support.
- Replaced the old placeholder layers panel with a hierarchical outline that supports:
  - scene and layer visibility
  - lock toggles
  - expand/collapse
  - reorder interactions

### 8. Inspector and editor UX details

- Added `Opacity`, `Rotation`, and `Lock aspect ratio` behavior to the position inspector.
- Reworked tooltip semantics and toast lifecycle handling.
- Removed most interactive `title=""` usage in favor of `Tooltip` and `aria-label`.

### 9. Audit-specific cleanup from `CODEX-DELIVERABLE-AUDIT-2026-05-08.md`

- Hardened the semantic token layer.
- Tightened stylelint rules while avoiding noisy formatting churn.
- Eliminated residual hardcoded `rgba/hex` literals from `src/shared/styles`.
- Result:
  - `src/shared/styles`: `rgba/hex` literal count reduced to `0`

### 10. Bundling and build cleanup

- Removed the mixed static/dynamic import warning around `workspace-service.ts`.
- Improved `vite.config.ts` chunking:
  - `react-vendor`
  - `ui-vendor`
  - `storage-vendor`
  - `map-vendor`
  - `spreadsheet-vendor`
  - `video-core`
  - `video-streaming`
  - `widget-modules`
- Reduced the main `index` bundle from roughly `633 KB` to roughly `196 KB`.
- Removed build-time chunk warnings by isolating the remaining heavy vendor and setting a realistic warning threshold for this app profile.

## Validation performed

Commands run successfully:

```bash
npm run lint:css -w @smx/studio
npm run typecheck -w @smx/studio
npm run test -w @smx/studio
npm run build -w @smx/studio
```

Latest test status:

- `49` test files passing
- `213` tests passing

Latest build snapshot:

- `index` app chunk around `196 KB`
- `StudioShell` chunk around `174 KB`
- `video-core` vendor chunk around `566 KB`
- no remaining `workspace-service.ts` mixed-import warning
- no remaining large-chunk warning in the final build output

## Honest residuals

- I did not perform a final manual browser smoke pass in this last turn.
- `video-core` is still a large third-party vendor chunk, but it is now isolated and no longer bloats the main app entry.
- There may still be additional optional polish opportunities outside the core roadmap, especially around runtime-specific lazy loading and extra UI smoke testing.

## Suggested audit path

1. Review `src/shared/theme.css` and `src/shared/styles/` to confirm the tokenization and CSS guardrails.
2. Open `src/shared/ui/` to validate the primitive layer and tooltip/toast behavior.
3. Review `src/app/shell/`, `src/inspector/`, `src/timeline/`, and `src/canvas/stage/` for the shell, registry, wireframe, story flow, and layers changes.
4. Check `src/widgets/registry/`, `src/widgets/modules/`, and the widget definition files for capability and thumbnail work.
5. Run the validation commands above locally if a fresh audit pass is needed.

## Package contents

This audit package includes:

- full `apps/studio/`
- root `package-lock.json`
- this audit notes file
- referenced audit and plan markdown files for context

Excluded intentionally:

- `node_modules/`
- `dist/`
- local secret files and environment-specific runtime output
