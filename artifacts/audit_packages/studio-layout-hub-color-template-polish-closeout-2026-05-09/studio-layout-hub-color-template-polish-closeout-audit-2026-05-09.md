# Studio Layout, Hub, Color, Template Polish Closeout

Date: 2026-05-09
Branch: `codex/s50-staging-rc`
Plan source: `/Users/enzocienfuegos/Downloads/CODEX_STUDIO_LAYOUT_HUB_COLOR_TEMPLATE_POLISH_PLAN (1).md`

## Outcome

This closeout implements the layout and polish plan across the Studio frontend with a focus on:

- making the editor shell less crowded
- simplifying the Agency Hub and Client Workspace hierarchy
- reducing fuchsia overuse in secondary states
- making Widget Library previews feel more alive and curated
- surfacing stronger templates, led by the Bocadeli World Cup starter
- preserving the existing quality gates and visual debt guardrails

No release-blocking gaps remain for this plan.

## Implemented Scope

### PR-01 Editor Layout Robustness

- Tightened export/readiness density in [TopBarActions.tsx](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/app/shell/topbar/TopBarActions.tsx) and related top bar styles.
- Improved inspector hero hierarchy in [RightInspector.tsx](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/inspector/RightInspector.tsx) so the document/widget label and title do not visually collapse.
- Repositioned the floating preflight surface in [shell-overlays.css](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/shell-overlays.css) so it anchors near the top-right work area instead of competing with the bottom canvas/timeline zone.
- Reduced density in [TimelineHeader.tsx](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/timeline/components/TimelineHeader.tsx) and [timeline-ux.css](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/timeline-ux.css).

### PR-02 Color Harmony and Fuchsia Discipline

- Shifted many active/hover states from fuchsia-heavy treatments toward calmer focus/cyan/neutral variants in:
  - [controls.css](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/controls.css)
  - [topbar.css](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/topbar.css)
  - [topbar-actions.css](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/topbar-actions.css)
  - [template-gallery.css](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/template-gallery.css)
  - [platform-agency-command-center.css](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/platform-agency-command-center.css)
  - [platform-workspace-launchpad.css](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/platform-workspace-launchpad.css)

### PR-03 Widget Library Card Redesign and Universal Preview Motion

- Redesigned cards in [WidgetLibrarySection.tsx](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/app/shell/left-rail/WidgetLibrarySection.tsx) to be less text-dense and more editorial.
- Added universal preview affordance and motion shell in [left-rail-library.css](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/left-rail-library.css) so even static cards feel alive on hover/focus.
- Simplified metadata density, tags, and footer messaging.

### PR-04 Agency Hub Simplification

- Rebuilt [AgencyShell.tsx](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/platform/AgencyShell.tsx) around:
  - continue work
  - client workspaces
  - new campaign
- Removed dashboard-heavy hierarchy such as cross-client explorer prominence, most-visited momentum sections, and review-first framing.
- Updated [AgencyCommandHero.tsx](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/platform/agency-shell/AgencyCommandHero.tsx) to reflect the new command priority.

### PR-05 Client Workspace Simplification

- Rebuilt [ClientWorkspaceShell.tsx](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/platform/ClientWorkspaceShell.tsx) so the top of the page is a cleaner launchpad rather than a form-heavy admin dashboard.
- Kept project management tools lower in the flow while making template, blank canvas, and scalable starter entry points explicit.
- Reduced cognitive competition from create-client/new-project forms at the top of the workspace.

### PR-06 Template Curation and Bocadeli World Cup Surfacing

- Extended template metadata in [types.ts](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/templates/library/types.ts) with curation fields:
  - `featured`
  - `featuredLabel`
  - `curationRank`
  - `sceneCount`
  - `moduleHighlights`
  - `recommendedFor`
- Updated [registry.ts](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/templates/library/registry.ts) to sort by curation priority.
- Promoted [world-cup/index.ts](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/templates/library/world-cup/index.ts) as the flagship starter.
- Added curation metadata to stronger sports, ecommerce, and CPG starters.
- Added a featured template surface in [TemplateGallery.tsx](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/platform/template-gallery/TemplateGallery.tsx) and richer facts in [TemplateCard.tsx](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/platform/template-gallery/TemplateCard.tsx).
- The scalable starter path in the client workspace now prefers the Bocadeli World Cup starter when available.

### PR-07 Visual QA Hardening

- Updated the visual helper in [setup.ts](/Users/enzocienfuegos/Documents/MandaRion/apps/studio/tests/visual/helpers/setup.ts) to reflect the new hub heading copy.
- Refreshed affected Playwright snapshots for shell, export, inspector, widget library, and timeline surfaces.

## Validation

Executed successfully:

- `npm run lint -w @smx/studio`
- `npm run typecheck -w @smx/studio`
- `npm run test -w @smx/studio`
- `npm run build -w @smx/studio`
- `npm run audit:visual-debt -w @smx/studio`
- `npm run test:visual:update -w @smx/studio`
- `npm run test:visual -w @smx/studio`

Final automated results:

- unit/integration suite: `89` files, `365` tests passing
- visual regression suite: `16/16` passing
- visual debt baseline:
  - `files over threshold: 0`
  - `inline styles: 0`
  - `numeric z-index uses: 0`
  - `!important uses: 0`

## Notes for Audit

- The Agency Hub is intentionally shorter and less analytics-heavy than before. The reduction in page height is part of the product goal, not a regression.
- The Client Workspace now favors launch choices and curation over top-heavy admin forms.
- Template marketplace curation is now data-backed, not purely presentational.
- The remaining unrelated worktree noise in `artifacts/` and `packages/db/migrations/0023_video_transcode_jobs.sql` was intentionally left untouched and is not part of this closeout.
