# Studio Frontend Audit Notes

Date: 2026-05-08
Scope: `/Users/enzocienfuegos/Documents/MandaRion/apps/studio`
Audit context:
- `/Users/enzocienfuegos/Documents/MandaRion/artifacts/studio_front_audit_2026-05-07.md`
- `/Users/enzocienfuegos/Downloads/files/STUDIO-CODEX-IMPLEMENTATION-PLAN-2026-05-08.md`
- `/Users/enzocienfuegos/Downloads/files/STUDIO-UX-AUDIT-2026-05-08.md`

## Deliverable Summary

This audit package contains the current `apps/studio` frontend implementation after executing the Studio frontend plan through the end of Sprint 11, plus the root `package-lock.json` because new frontend dependencies and scripts were introduced for CSS guardrails.

Estimated plan completion: `97-98%`

What remains outside this package:
- Manual visual smoke / browser review of the final UI state
- Optional post-plan polish such as chunk splitting improvements and broader tooltip/toast propagation outside the core Sprint 11 scope

## What Was Implemented

### Sprint 1
- Split legacy styling into domain CSS files under `src/shared/styles/`
- Left `src/shared/layout.css` as a shim
- Expanded `src/shared/theme.css` into the main token source
- Added CSS guardrails with `stylelint`

Key files:
- `src/shared/theme.css`
- `src/shared/layout.css`
- `src/shared/styles/*`
- `.stylelintrc.cjs`
- `package.json`

### Sprint 2
- Central icon system in `src/shared/ui/icons.tsx`
- Replaced shell/editor glyph usage with shared icons
- Added shared renderer-side icon helpers

Key files:
- `src/shared/ui/icons.tsx`
- `src/widgets/modules/render-icons.tsx`

### Sprint 3
- Added UI primitives:
  - `Button`
  - `IconButton`
  - `Tabs`
  - `Tile`
  - `SegmentedControl`
- Migrated repeated shell, inspector, and timeline controls to primitives
- Reduced inline styles in target UI areas below the plan threshold

Key files:
- `src/shared/ui/Button.tsx`
- `src/shared/ui/IconButton.tsx`
- `src/shared/ui/Tabs.tsx`
- `src/shared/ui/Tile.tsx`
- `src/shared/ui/SegmentedControl.tsx`
- `src/shared/styles/components.css`

### Sprint 4
- Persisted shell layout between sessions
- Right inspector made resizable

Key files:
- `src/app/shell/use-shell-layout.ts`
- `src/app/shell/StudioShell.tsx`

### Sprint 5
- Refactored document inspector into a registry-driven flow

Key files:
- `src/inspector/document-inspector-registry.ts`
- `src/inspector/register-document-inspector.tsx`
- `src/inspector/panels/DocumentInspectorPanel.tsx`

### Sprint 6
- Added widget capabilities to the shared widget contract
- Removed primary UI whitelists in favor of capability checks

Key files:
- `src/widgets/registry/widget-definition.ts`
- `src/widgets/modules/module-definition-factory.ts`
- `src/canvas/stage/Stage.tsx`
- `src/app/shell/left-rail/use-left-rail-controller.ts`
- `src/app/shell/left-rail/use-asset-library-controller.ts`

### Sprint 7
- Added widget thumbnails in the widget library
- Wired shared/fallback previews into the left rail

Key files:
- `src/widgets/registry/widget-thumbnails.tsx`
- `src/app/shell/left-rail/WidgetLibrarySection.tsx`

### Sprint 8
- Added edit-mode wireframe rendering
- Added persistent wireframe preference
- Added wireframe toggle in stage controls

Key files:
- `src/canvas/stage/render-widget.tsx`
- `src/canvas/stage/stage-view-preferences.ts`
- `src/canvas/stage/components/StageWidget.tsx`
- `src/canvas/stage/components/StageFloatingToolbar.tsx`

### Sprint 9
- Added Story Flow canvas mode with persisted layout positions

Key files:
- `src/app/shell/left-rail/StoryFlowCanvas.tsx`
- `src/app/shell/left-rail/story-flow-preferences.ts`
- `src/core/store/reducers/document-scene-reducer.ts`

### Sprint 10
- Replaced Layers placeholder with a real outline/reorder panel

Key files:
- `src/app/shell/left-rail/LayersSection.tsx`
- `src/app/shell/left-rail/layer-outline.ts`

### Sprint 11
- Reorganized top bar into 3 zones
- Added accessible `Tooltip`
- Added global `Toast` system
- Removed stage toolbar clamp magic numbers with measured bounds
- Moved stage swatches to config
- Added `Opacity`, `Rotation`, and `Lock aspect ratio` to `PositionSection`
- Standardized `LoginScreen` language to English
- Cleaned remaining interactive `title=""` usage in core shell/timeline/editor UI

Key files:
- `src/app/shell/TopBar.tsx`
- `src/app/shell/topbar/TopBarCenterContent.tsx`
- `src/app/shell/topbar/TopBarActions.tsx`
- `src/app/shell/topbar/TopBarProjectName.tsx`
- `src/shared/ui/Tooltip.tsx`
- `src/shared/ui/ToastProvider.tsx`
- `src/canvas/stage/Stage.tsx`
- `src/canvas/stage/components/stage-utils.ts`
- `src/inspector/sections/PositionSection.tsx`
- `src/platform/LoginScreen.tsx`

## Validation Performed

Executed successfully:

```bash
npm run typecheck -w @smx/studio
npm run test -w @smx/studio
npm run lint:css -w @smx/studio
npm run build -w @smx/studio
```

Latest result:
- Test files: `49`
- Tests passing: `212`

Known non-blocking build warnings:
- Mixed static/dynamic import warning for `src/platform/workspace-service.ts`
- Chunk size warnings in production build

## Plan Metrics Snapshot

Relevant end-state metrics observed during implementation:

- `src/shared/styles/*.css`: all files under `800` lines
- `style={{...}}` in `src/inspector`, `src/app/shell`, `src/timeline`: `13`
- Interactive `title=""` usage in core shell/editor/timeline UI: cleaned; remaining `title` usage is semantically valid or non-HTML-tooltip chart props

Current CSS line counts:

```text
asset-library.css 340
components.css 293
index.css 10
inspector.css 243
left-rail.css 591
platform.css 735
shell.css 188
stage.css 768
timeline.css 640
topbar.css 400
utilities.css 229
```

## Remaining Audit Focus

Recommended manual audit checklist:

1. Open Studio shell and verify top bar layout at desktop and narrower widths.
2. Verify left rail, right inspector, and timeline resizing interactions.
3. Toggle wireframe mode and confirm selected widgets still render normally.
4. Open Story Flow canvas and verify drag/persist behavior.
5. Check Layers outline expand/collapse, lock/hide toggles, and reorder behavior.
6. Verify widget library thumbnails and drag-to-canvas flow.
7. Check toasts from save/export/share/publish flows.
8. Review tooltip behavior for keyboard focus and hover in top bar, stage toolbar, timeline, and collapse controls.

## Packaging Notes

The zip intentionally includes:
- `apps/studio/`
- `package-lock.json`
- this audit markdown

The zip intentionally excludes unrelated repo changes outside Studio scope.
