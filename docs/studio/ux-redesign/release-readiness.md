# Studio UX/UI Release Readiness

Date: 2026-05-09
Surface: `apps/studio`

## Before / After

- Before: Agency and client entry points felt operational, dense, and too similar to internal tooling.
- After: Agency Hub now reads like a command center, while Client Workspace behaves like a launchpad with clear creation paths.
- Before: the editor shell spread attention evenly across topbar, rails, canvas, inspector, and timeline.
- After: the canvas and selection state are easier to read, export/readiness are surfaced earlier, and the supporting rails feel more intentionally tiered.
- Before: widget discovery was flat and mechanical.
- After: Widget Library is grouped by creative intent with richer cards, capability signals, runtime hints, and clearer add affordances.
- Before: Brand Kit felt like a utility overlay.
- After: it behaves like a premium governance surface with preview strips, reusable kit cards, and clearer document-application context.
- Before: timeline controls were functional but understated.
- After: scene navigation, motion affordances, row metadata, and icon-only controls have stronger hierarchy and clearer feedback.
- Before: representative heavy widget code risked leaking into lightweight routes.
- After: hub/workspace/editor route boundaries and lazy widget runtime loading are hardened enough for current Studio surfaces.

## What changed

- Agency Hub now behaves like a command center instead of a metrics dashboard.
- Client Workspace now behaves like a creative launchpad with clearer entry paths.
- Widget Library is grouped by creative intent and uses richer marketplace-style cards.
- Editor shell has stronger topbar hierarchy, clearer selection HUD, and better export/readiness context.
- Brand Kit now uses a focused side-panel model with preview surfaces instead of feeling like an accidental overlay.
- Timeline now has clearer scene context, richer row metadata, and a guided empty state.
- Heavy widget runtime loading now begins moving behind lazy boundaries for representative complex widgets such as `dynamic-map` and `interactive-video`.
- Icon-only controls across topbar, left rail, inspector, stage, and timeline now use shared tooltip timing/placement, stronger hover/focus treatment, and cleaner toggle semantics.

## Visual QA coverage

The current visual suite covers:

- login shell
- agency command center
- client workspace onboarding
- editor blank state
- widget library visible state
- text / CTA / QR widget stage states
- export menu
- preflight tray
- export + preflight combined state
- Brand Kit drawer
- document data / variants state
- widget inspector state
- timeline empty state
- timeline with seeded widgets

## UX/UI QA checklist

- Hub surfaces still communicate “where do I go next?” within the first screenful.
- Template-first creation remains clearer than blank-canvas creation for new users.
- Selected-widget context is legible without opening the inspector first.
- Export/readiness meaning is understandable from topbar and inspector without deep menu drilling.
- Brand Kit cards, preview strip, and apply flows still read as one system.
- Timeline icon-only controls expose accessible names and visible focus states.
- Widget Library cards remain readable at common laptop widths without collapsing intent/category context.
- Route-level code splitting remains intact for Agency Hub, Workspace Hub, Editor shell, and representative heavy widgets.
- Visual snapshot changes are reviewed intentionally instead of bulk-refreshed.

## Known limitations

- `StudioShell` and the shared topbar/controller chunk are still heavier than ideal; current work focused on safe lazy boundaries rather than a deeper controller split.
- Only representative heavy widgets have been moved to the lazy runtime pattern so far; more modules can follow the same registry approach later.
- Tooltip behavior is standardized for current premium surfaces, but future icon-only controls still need to adopt the shared `IconButton` path instead of ad hoc buttons.
- The current visual suite is strong on baseline states and key UX surfaces, but it is not a substitute for exploratory review of dense document scenarios.

## Validation checklist

- `npm run lint -w @smx/studio`
- `npm run typecheck -w @smx/studio`
- `npm run test -w @smx/studio`
- `npm run build -w @smx/studio`
- `npm run audit:visual-debt -w @smx/studio`
- `npm run test:visual -w @smx/studio`

## Readiness expectations

- No inline styles added in feature code.
- No `!important`.
- No numeric `z-index`.
- No raw color literals outside token/theme files.
- Visual snapshots updated intentionally, not blindly.
- Widget Library must render from lightweight metadata without eagerly pulling representative heavy runtimes.
- Export/readiness surfaces must stay understandable without drilling through menus.

## Remaining watch items

- Continue moving more heavy widgets to the lazy runtime pattern after `dynamic-map` and `interactive-video`.
- Keep icon-only controls audited for clear tooltip and accessible name coverage as new surfaces are added.
- Re-check hub/editor bundle shape whenever a widget definition starts importing new vendor code.
