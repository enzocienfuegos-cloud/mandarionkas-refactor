# Studio UX/UI Closeout Audit Notes

Date: `2026-05-08`
Scope: `apps/studio`
Primary plan: `STUDIO-UX-UI-IMPROVEMENT-PLAN-2026-05-08.md`

## Executive summary

This package captures the current closeout state of Studio after the UX/UI improvement roadmap, the size-set/shared-layer work, the export bundle work, and the local QA unblock.

The editor is now in a strong audit state:

- `Phase A`: implemented
- `Phase B`: implemented
- `Phase C`: implemented
- `Phase D`: substantially implemented
- `Phase E`: implemented

The remaining work is not a missing subsystem. What remains is mostly manual QA depth, optional polish, and a few architectural hotspots that are worth reviewing but are no longer blockers for the roadmap itself.

## What was implemented in this closeout

### 1. UX/UI system work

- Shared theme/token layer expanded and enforced through `stylelint`.
- Button, icon button, tabs, segmented control, tile, tooltip, toast, and surface-button primitives propagated across the shell.
- Top bar, left rail, right inspector, timeline, asset library, and shell layout were migrated away from many local one-off patterns.
- Interactive `title=` usage was mostly replaced with `Tooltip` or `aria-label`.

Key files:

- `apps/studio/src/shared/theme.css`
- `apps/studio/src/shared/styles/components.css`
- `apps/studio/src/shared/ui/Button.tsx`
- `apps/studio/src/shared/ui/IconButton.tsx`
- `apps/studio/src/shared/ui/Tooltip.tsx`
- `apps/studio/src/shared/ui/ToastProvider.tsx`
- `apps/studio/src/shared/ui/SurfaceButton.tsx`

### 2. Studio shell and editor usability

- Shell panel sizes persist.
- Right inspector is resizable.
- Inspector accordion state persists by widget type.
- Keyboard shortcuts are centralized and exposed through a cheat sheet.
- Widget library now supports richer metadata and thumbnail/previews.
- Preflight tray is persistent in-shell.
- Scene switching was moved from the top bar to the timeline header, implemented as a documented dropdown divergence rather than a chip strip to keep the header single-row on common widths.

Key files:

- `apps/studio/src/app/shell/StudioShell.tsx`
- `apps/studio/src/app/shell/use-shell-layout.ts`
- `apps/studio/src/app/shell/use-shell-resize.ts`
- `apps/studio/src/app/shell/StudioKeyboardShortcuts.tsx`
- `apps/studio/src/app/shell/KeyboardShortcutsModal.tsx`
- `apps/studio/src/app/shell/PreflightTray.tsx`
- `apps/studio/src/app/shell/left-rail/WidgetLibrarySection.tsx`

### 3. Capability- and registry-driven cleanup

- Document inspector became registry-driven.
- Widget capabilities replaced many hardcoded media/asset/type whitelists in UI/state consumers.
- Widget library contract now carries richer metadata.

Key files:

- `apps/studio/src/inspector/document-inspector-registry.ts`
- `apps/studio/src/inspector/register-document-inspector.tsx`
- `apps/studio/src/widgets/registry/widget-definition.ts`
- `apps/studio/src/widgets/modules/module-definition-factory.ts`

### 4. Preview and authoring improvements

- Preview frame context exists and is persisted.
- Wireframe mode exists and is persisted.
- Story Flow canvas exists with drag/persisted scene layout.
- Layers panel became hierarchical and interactive.

Key files:

- `apps/studio/src/domain/preview/preview-frames.ts`
- `apps/studio/src/canvas/stage/Stage.tsx`
- `apps/studio/src/canvas/stage/render-widget.tsx`
- `apps/studio/src/app/shell/left-rail/StoryFlowCanvas.tsx`
- `apps/studio/src/app/shell/left-rail/LayersSection.tsx`

### 5. Multi-size / size-set support

- Studio now models `canvasVariants`.
- Active size variant is selectable from the shell.
- Variant-local overrides for `frame`, `style`, and `props` exist.
- Inspector surfaces show inheritance/override state and allow reset to master.
- Multi-size ZIP export exists.
- Shared assets in size-set export are now deduplicated into `bundle/shared/assets/...`.

Key files:

- `apps/studio/src/domain/document/canvas-variants.ts`
- `apps/studio/src/app/shell/CanvasVariantStrip.tsx`
- `apps/studio/src/core/store/reducers/widgets/widget-frame-reducer.ts`
- `apps/studio/src/core/store/reducers/widgets/widget-create-update-reducer.ts`
- `apps/studio/src/inspector/sections/PositionSection.tsx`
- `apps/studio/src/inspector/sections/TextSection.tsx`
- `apps/studio/src/inspector/sections/FillSection.tsx`
- `apps/studio/src/export/bundle.ts`
- `apps/studio/src/export/portable.ts`

### 6. Shared layers across scenes

- A widget can be converted into a shared layer.
- Shared-layer edits propagate from the base scene.
- Per-scene overrides for shared layers exist.
- Inspector badges show inherited vs local scene override state.
- Timeline and layers show shared-layer indicators.
- Export now uses resolved widgets, so scene overrides are reflected in portable output.

Key files:

- `apps/studio/src/core/store/reducers/widgets/widget-structure-reducer.ts`
- `apps/studio/src/inspector/use-widget-inheritance.ts`
- `apps/studio/src/timeline/components/TimelineTrackRow.tsx`
- `apps/studio/src/app/shell/left-rail/LayersSection.tsx`
- `apps/studio/src/export/portable.ts`

### 7. Local QA unblock

One real issue found during smoke QA was that local manual testing could log in only until the API boundary, because `/v1/auth/*` was unavailable.

That is now handled:

- In non-production envs, seed users can log in locally when the Platform API is unavailable.
- Repository mode is now real, not a stub.
- The auth fallback switches project/document/asset repositories to `local`, so project creation and editor entry work in local QA without backend availability.

Key files:

- `apps/studio/src/platform/auth-service.ts`
- `apps/studio/src/repositories/mode.ts`
- `apps/studio/src/repositories/services.ts`

## Validation run

Automated validation completed successfully:

- `npm run lint:css -w @smx/studio`
- `npm run typecheck -w @smx/studio`
- `npm run test -w @smx/studio`
- `npm run build -w @smx/studio`

Latest result:

- `55` test files passing
- `254` tests passing
- production build green

Build snapshot from the last validation:

- `dist/assets/index-*.js`: about `200 KB`
- `dist/assets/StudioShell-*.js`: about `204 KB`
- `dist/assets/widget-modules-*.js`: about `475 KB`
- `dist/assets/video-core-*.js`: about `567 KB`

## Manual smoke QA completed

The following browser smoke flow was verified locally against `http://127.0.0.1:5174/`:

1. Login screen loads correctly.
2. Local fallback login works with `admin@smx.studio` / `demo123` when backend auth is unavailable.
3. Agency shell loads.
4. Client workspace opens.
5. Creating a new project from client workspace now transitions into `#/editor`.
6. Editor shell loads with:
   - top bar
   - widget library
   - canvas variant strip
   - timeline
   - right inspector

## Hardcode and scalability audit snapshot

These numbers are current quick-audit metrics, not aspirational targets:

- Inline style occurrences across all `apps/studio/src`: `481`
- Raw `hex/rgba(...)` literals in `apps/studio/src/shared/styles`: `0`
- `widget.type ===` / `!==` occurrences across all `apps/studio/src`: `21`
- `title=` occurrences across `.tsx`: `14`

### Interpretation

#### Inline styles

The large remaining inline-style count is now concentrated mostly in widget renderers and preview/runtime surfaces, not in the shared shell/design-system layer.

Representative hotspots:

- `apps/studio/src/widgets/modules/teads-layout1.renderer.tsx`
- `apps/studio/src/widgets/modules/dynamic-map.renderer.tsx`
- `apps/studio/src/widgets/modules/buttons.renderer.tsx`
- `apps/studio/src/widgets/modules/shared-styles.tsx`
- `apps/studio/src/widgets/video-hero/video-hero.renderer.tsx`

This is the biggest remaining “hardcoded UI” vector if the team wants to push Studio further toward a uniform design-system contract.

#### `widget.type` conditionals

These are no longer concentrated in shell/state consumers. The remaining matches are mostly expected domain/export special-casing:

- export validation
- export packaging/compliance
- portable asset inference
- a few starter or test helpers

Representative files:

- `apps/studio/src/domain/document/export-validation.ts`
- `apps/studio/src/export/asset-resolution.ts`
- `apps/studio/src/export/mraid-compatibility.ts`
- `apps/studio/src/export/readiness.ts`
- `apps/studio/src/export/channel-compliance.ts`

This is acceptable for now, but it is still a scaling hotspot if the widget surface keeps growing.

#### `title=` usage

Residual `title=` usage is small and concentrated. Some are semantically valid, some remain interactive/runtime shortcuts:

- `apps/studio/src/widgets/modules/dynamic-map.renderer.tsx`
- `apps/studio/src/widgets/video/CompanionAdSlot.tsx`
- `apps/studio/src/widgets/video/overlays/CustomHtmlOverlay.tsx`
- `apps/studio/src/app/shell/AssetLibraryModal.tsx`
- `apps/studio/src/app/shell/left-rail/AssetLibrarySection.tsx`

#### File size hotspots

Largest code/style files worth a scalability review:

- `apps/studio/src/testing/unit/export/engine.test.ts` — very large test surface
- `apps/studio/src/export/runtime-script.ts`
- `apps/studio/src/shared/styles/stage.css`
- `apps/studio/src/shared/styles/platform.css`
- `apps/studio/src/shared/styles/timeline.css`
- `apps/studio/src/widgets/modules/export-renderers.ts`
- `apps/studio/src/canvas/stage/Stage.tsx`
- `apps/studio/src/app/shell/AssetLibraryModal.tsx`

These are not necessarily wrong, but they are where maintainability pressure is accumulating.

## Recommended audit order

If another developer is auditing this package, the highest-signal order is:

1. `apps/studio/src/shared/theme.css`
2. `apps/studio/src/shared/styles/`
3. `apps/studio/src/shared/ui/`
4. `apps/studio/src/platform/auth-service.ts`
5. `apps/studio/src/repositories/mode.ts`
6. `apps/studio/src/repositories/services.ts`
7. `apps/studio/src/domain/document/canvas-variants.ts`
8. `apps/studio/src/core/store/reducers/widgets/`
9. `apps/studio/src/export/bundle.ts`
10. `apps/studio/src/export/portable.ts`
11. `apps/studio/src/canvas/stage/Stage.tsx`
12. `apps/studio/src/app/shell/CanvasVariantStrip.tsx`
13. `apps/studio/src/inspector/use-widget-inheritance.ts`
14. `apps/studio/src/inspector/sections/PositionSection.tsx`
15. `apps/studio/src/inspector/sections/TextSection.tsx`
16. `apps/studio/src/inspector/sections/FillSection.tsx`

## Honest residuals

These are the real residuals after this closeout:

- The shared shell/design-system layer is much cleaner, but widget renderers still contain substantial local presentation logic and inline styling.
- Export/domain logic still contains widget-type branching that may deserve a second capabilities pass later.
- `widget-modules` and `video-core` remain large chunks even after chunking improvements.
- The package has good smoke coverage, but not exhaustive visual regression coverage.
- The editor is now locally testable without backend auth, but local fallback mode is intentionally a QA convenience, not a production auth strategy.

## Package contents

This audit package includes:

- `apps/studio/`
- root `package-lock.json`
- root `package.json`
- `artifacts/studio_front_audit_2026-05-07.md`
- `STUDIO-UX-UI-IMPROVEMENT-PLAN-2026-05-08.md`
- this closeout audit note

## Bottom line

Studio is in a credible audit state.

The roadmap work is largely implemented, the editor is operational in local QA without backend auth, the design-system layer is much cleaner than before, and the biggest remaining audit concerns are now concentrated and visible rather than scattered:

- widget renderer hardcodes
- a handful of export/domain branches
- some large files that merit future decomposition
