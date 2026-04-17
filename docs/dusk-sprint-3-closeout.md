# Dusk Sprint 3 Closeout

## Status

Sprint 3 is functionally close to complete.

The export runtime now covers:

- multi-exit widgets and `targetKey`
- stage authoring visibility for sub-target coverage
- export package files with neutral bundle structure
- scene navigation in the packaged runtime
- scene auto-advance and visual transitions
- widget state actions: `show-widget`, `hide-widget`, `toggle-widget`
- text mutation via `set-text`
- `timeline-enter` for runtime-safe actions
- visual states at widget root and for core sub-targets
- lightweight canvas backgrounds via solid color or CSS gradient

## What Landed

### Core export/runtime

- neutral export model with scenes, nodes, exits, assets and runtime actions
- package runtime wiring for `open-url`, `go-to-scene`, widget visibility actions and text actions
- DOM-first binding through `data-target-key`, with overlay fallback
- auto-advance using `durationMs`
- scene transitions using `transition.type` and `transition.durationMs`

### Core widget fidelity

- `text`, `shape`, `badge`, `image`, `hero-image` export as usable HTML/media
- `buttons` exports real DOM structure with `primary-button` and `secondary-button`
- `interactive-hotspot` exports real DOM structure with `hotspot-pin` and `hotspot-card`
- visual states now exist for root widgets and core sub-targets

### Diagnostics/readiness

- capability-aware readiness
- multi-target coverage warnings
- bundled vs external vs blob asset packaging summary
- export and diagnostics panels now expose packaging risk directly

## Known Gaps Before Sprint 4 Hardening

- no automated verification has been run in this workspace because `node_modules` are missing
- `group` is still a simple export placeholder and should be revisited if groups need package-time semantics
- `image-carousel`, `video-hero` and richer Tier B/Tier C modules still need explicit graduation or degradation decisions
- root-level visual states are broad; some complex widgets may need deeper per-part state styling later
- asset packaging still exposes external and `blob:` references when no local payload is available

## Recommended Sprint 4 Start

1. Add export fixtures and tests for mixed creatives:
   - multi-scene
   - multi-target
   - external asset references
   - timeline-enter actions

2. Finalize support policy per module:
   - `supported`
   - `degraded`
   - `unsupported`

3. Harden package diagnostics:
   - unresolved assets
   - external dependency notes
   - degradation disclosure

4. Revisit `group`, `video-hero`, `image-carousel` and other degraded modules with explicit product decisions.

## Exit Criteria For Marking Sprint 3 Closed

- code compiles locally once dependencies are installed
- smoke tests pass for export manifest and readiness
- package runtime can:
  - open exits
  - navigate scenes
  - auto-advance scenes
  - apply widget visibility actions
  - apply text actions
  - run timeline-enter actions
- export UI clearly reports:
  - capability degradations
  - target coverage gaps
  - asset packaging risks
