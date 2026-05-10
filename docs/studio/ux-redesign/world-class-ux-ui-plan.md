# Studio World-Class UX/UI Plan

Studio should feel like a premium creative command center rather than an internal operations tool.

## Surfaces

- Agency Hub: continue work, create campaign, review exports, monitor client readiness.
- Client Workspace: launchpad for template-first creation, blank creation, and dynamic/variant flows.
- Editor Shell: stronger canvas focus, premium controls, clearer hierarchy between rails, stage, inspector, and timeline.
- Library: marketplace-like browsing for widgets, templates, and assets.
- Brand Kit: visually distinct system for brand governance without colliding with editor density.
- Timeline: clearer motion, playhead, live states, and interaction affordances.

## Visual direction

- Fuchsia: primary actions, selected states, active navigation.
- Violet: premium depth, gradients, creative emphasis.
- Cyan: guides, data, snapping, helper overlays.
- Green: success only.
- Amber: warning only.
- Red: blocking errors only.

## Implementation model

- Keep changes token-driven.
- Preserve route decoupling between Agency Hub, Client Workspace, Editor, Inspector, Timeline, and Widgets.
- Prefer small PRs with visual snapshots.
- Maintain zero inline styles debt, zero `!important`, and zero numeric `z-index`.
