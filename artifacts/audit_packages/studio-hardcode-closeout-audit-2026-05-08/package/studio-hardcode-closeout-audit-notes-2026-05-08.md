# Studio Hardcode Closeout Audit

Date: 2026-05-08
Repo: `/Users/enzocienfuegos/Documents/MandaRion`
Scope: `/Users/enzocienfuegos/Documents/MandaRion/apps/studio`

## Executive Summary

This audit package covers the Studio frontend after a long cleanup pass across UX/UI, architecture, widget contracts, export portability, and hardcoded visual/runtime defaults.

The most important outcomes are:

- `src/**/*.tsx` is now at `0` occurrences of `style={{...}}`.
- `src/shared/styles` is at `0` direct `hex/rgba` literals.
- legacy global `button {}`, `button.primary`, and `button.ghost` fallbacks were removed from the shared theme layer.
- module/widget defaults that were previously duplicated across `definition`, `renderer`, `inspector`, and `export` are now increasingly centralized in `*.shared.ts`.
- multi-size variants, shared layers, preflight, live preview frames, and export bundle logic were implemented as real systems rather than one-off UI patches.

This is not a “no literals anywhere in the repo” claim. It is a claim that the base editor shell, shared style system, and a large portion of widget/runtime defaults were intentionally normalized and made much more auditable.

## Validation Snapshot

Latest validation run:

- `npm run typecheck -w @smx/studio`
- `npm run test -w @smx/studio`

Result:

- `55` test files passed
- `254` tests passed

## Current Audit Metrics

These are useful starting points for a reviewer:

- `rg -n "style=\\{\\{" apps/studio/src --glob '*.tsx' | wc -l` -> `0`
- `rg -n "#[0-9a-fA-F]{3,8}|rgba\\(" apps/studio/src/shared/styles | wc -l` -> `0`
- `find apps/studio/src/widgets/modules -name '*.shared.ts' | wc -l` -> `14`

Notes on grep interpretation:

- searching for `Sponsored`, `Shop Now`, `yourbrand`, `12.4K`, etc. still returns matches in `*.shared.ts` files by design; those are now the central source of truth.
- searching for `className="ghost"` style legacy usage can produce false positives on names like `danger-action`; the old `ghost/primary/danger` global button style pattern itself is no longer the active fallback mechanism.

## What Was Implemented

### 1. Shared Style System and Tokens

The Studio shell and shared CSS were restructured so that visual primitives live in the shared style layer instead of ad hoc component CSS or inline JSX.

Key outcomes:

- CSS split into `src/shared/styles/*`
- stronger semantic token layer in `src/shared/theme.css`
- `stylelint` guardrails added and enforced
- `src/shared/styles` cleaned of direct `hex/rgba` literals
- transition timing and shared overlays/surfaces normalized

Primary files:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/theme.css`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/components.css`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/shell.css`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/inspector.css`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/left-rail.css`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/stage.css`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/timeline.css`

### 2. Shell, Top Bar, Left Rail, Timeline

The editor shell is no longer a mostly static mock with local quirks. It now behaves like a product surface with stateful resizing, persistence, navigation, and editor affordances.

Implemented:

- layout persistence for left rail / right inspector
- right inspector resizable
- top bar reorganized and cleaned
- scene switcher moved out of topbar and into timeline
- keyboard shortcut system + cheat sheet
- preflight tray with persistent shell UI
- story flow list/canvas modes with drag layout persistence
- layers panel with hierarchy, lock/hide, reorder, and shared-layer indicators

Primary files:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/app/shell/StudioShell.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/app/shell/TopBar.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/app/shell/CanvasVariantStrip.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/app/shell/PreflightTray.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/app/shell/StudioKeyboardShortcuts.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/timeline/BottomTimeline.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/timeline/components/TimelineHeader.tsx`

### 3. Shared UI Primitives

The shell/inspector now rely on shared components instead of a mixed bag of native button/select affordances and local styles.

Implemented or expanded:

- `Button`
- `IconButton`
- `Tabs`
- `SegmentedControl`
- `Tile`
- `SurfaceButton`
- `Tooltip`
- `ToastProvider`

Primary files:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/ui/Button.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/ui/IconButton.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/ui/Tooltip.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/ui/ToastProvider.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/ui/SurfaceButton.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/ui/README.md`

### 4. Widget Registry, Capabilities, Thumbnails, Inspector Layout

Widget behavior is less stringly-typed and less whitelist-driven than before.

Implemented:

- capability-based widget contracts
- accepted asset-kind helpers
- registry-driven document inspector
- inspector section predicates
- widget thumbnails/library previews
- library metadata like description, size, asset requirement, runtime hints

Primary files:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/registry/widget-definition.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/module-definition-factory.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/registry/widget-thumbnails.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/registry/widget-inspector-layout.tsx`

### 5. Stage, Preview, Wireframe, Device Frames

The canvas/stage layer now supports more real authoring modes instead of one flat view.

Implemented:

- wireframe mode with persistence
- preview device/article frames
- better toolbar clamp logic
- stage view preferences
- shared render helpers

Primary files:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/canvas/stage/Stage.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/canvas/stage/render-widget.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/canvas/stage/render-helpers.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/domain/preview/preview-frames.ts`

### 6. Multi-Size Variants and Shared Layers

This is one of the biggest architecture shifts in the codebase.

Implemented:

- size-set model with active variant
- per-variant widget overrides
- per-scene shared-layer overrides
- `Reset to master` and inheritance badges in inspector
- size strip with rename / duplicate / promote / delete
- export bundle aware of resolved variant/scene state

Primary files:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/domain/document/canvas-variants.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/domain/document/types.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/core/store/reducers/widgets/widget-frame-reducer.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/core/store/reducers/widgets/widget-create-update-reducer.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/inspector/use-widget-inheritance.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/inspector/sections/PositionSection.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/inspector/sections/TextSection.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/inspector/sections/FillSection.tsx`

### 7. Export, Portable HTML, and Bundle Structure

Export logic now reflects runtime/editor state much better.

Implemented:

- multi-size bundle output
- shared asset dedupe across variants
- root manifest for size-set bundles
- export using resolved widgets, including scene/variant overrides
- deduped Leaflet map `srcdoc` helper

Primary files:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/bundle.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/portable.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/engine.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/leaflet-map-srcdoc.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/export-renderers.ts`

### 8. Platform / Login / Local QA

Local QA no longer depends entirely on the backend being healthy.

Implemented:

- local auth fallback in non-production
- repository mode improvements
- local smoke path for `login -> agency shell -> workspace -> editor`

Primary files:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/platform/auth-service.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/platform/AgencyShell.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/platform/ClientWorkspaceShell.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/repositories/mode.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/repositories/services.ts`

## Hardcode Cleanup Results

### Inline Styles

The TSX inline-style sweep is complete in the Studio app source.

- `style={{...}}` in `apps/studio/src/**/*.tsx`: `0`

This was achieved by:

- moving static layout styles into CSS classes
- extracting runtime style constants/builders inside renderers
- creating shared helpers for repeated stage/widget patterns

### Shared Defaults

Several widgets now centralize defaults in `*.shared.ts` rather than duplicating them across `definition`, `renderer`, `inspector`, and `export`.

Current count:

- `14` shared widget/module contract files in `src/widgets/modules`

Examples:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/form.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/four-faces.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/vertical-accordion.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/speed-test.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/shoppable-sidebar.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/dynamic-map.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/teads.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/interactive-video.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/travel-deal.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/buttons.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/meta-carousel.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/tiktok-video.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/instagram-story.shared.ts`

### What Was Still Intentionally Left as Literal

Not every remaining literal is a problem.

Examples of acceptable residuals:

- output-specific HTML/CSS inside `export-renderers.ts`
- semantic copy that is now intentionally centralized in `*.shared.ts`
- widget-specific placeholder copy where the widget itself is supposed to ship with a demo/default state

## Recommended Audit Path

If another developer is auditing for hardcoded logic and scalability, this is the most efficient order:

### First pass: architecture and editor systems

Read these first:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/domain/document/types.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/domain/document/canvas-variants.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/registry/widget-definition.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/module-definition-factory.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/bundle.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/portable.ts`

Questions to ask:

- is the document model still doing too much in one shape?
- are widget overrides and shared layers conceptually clear enough?
- is the registry contract still missing fields that should be first-class?

### Second pass: shared UI and shell

Read:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/ui/README.md`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/theme.css`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/app/shell/StudioShell.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/app/shell/PreflightTray.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/app/shell/StudioKeyboardShortcuts.tsx`

Questions to ask:

- are there still shell interactions bypassing shared primitives?
- should more shell state be isolated from the main store snapshot?
- are tooltip/toast/shortcut patterns now consistent enough to enforce?

### Third pass: widgets and export portability

Read:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/*.shared.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/export-renderers.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/export/leaflet-map-srcdoc.ts`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/registry/widget-thumbnails.tsx`

Questions to ask:

- which defaults still belong in `*.shared.ts` but are not there yet?
- which export renderers are still too monolithic?
- which widgets should split runtime logic from view helpers more aggressively?

## Residual Risks and Honest Remaining Debt

This closeout is strong, but not magical. These are the main remaining concerns:

### 1. `export-renderers.ts` is still dense

It is cleaner than before, but still a large concentrated file with output-specific literals and formatting logic.

Why it matters:

- portable export remains a hotspot for future feature drift
- HTML generation and widget-specific rendering still share one broad surface

### 2. Widget shared defaults are improved, not universal

Many important modules now have `*.shared.ts`, but not every widget family is fully normalized yet.

Why it matters:

- new widgets may regress into local defaults unless the pattern is enforced

### 3. Store-connected shell surfaces are still powerful

The store model is much better structured than before, but some UI surfaces remain broad and responsibility-heavy.

Why it matters:

- future performance regressions are more likely to happen in shell/stage/export intersections than in simple UI primitives

### 4. Manual visual QA is still necessary

Automated tests are green, but Studio is a visual editor. Pixel/interaction regressions still require browser checks.

## Useful Audit Commands

Run from repo root:

```bash
rg -n "style=\\{\\{" apps/studio/src --glob '*.tsx'
rg -n "#[0-9a-fA-F]{3,8}|rgba\\(" apps/studio/src/shared/styles
find apps/studio/src/widgets/modules -name '*.shared.ts'
rg -n "buildPortableExport|renderExport|renderStage" apps/studio/src/widgets/modules
rg -n "canvasVariants|widgetOverrides|sharedLayer" apps/studio/src
rg -n "useStudioStore\\(" apps/studio/src/app apps/studio/src/inspector apps/studio/src/canvas
```

## Package Contents

This audit package includes:

- the full `apps/studio` source tree
- `package-lock.json`
- `package.json`
- `tsconfig.base.json`
- this audit note

That should be enough for another developer to understand both:

- feature/system architecture
- the current state of hardcode cleanup and remaining scalability concerns
