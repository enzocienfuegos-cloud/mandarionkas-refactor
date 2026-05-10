# Studio AGENTS.md

## Scope

This package is the Studio frontend in `apps/studio`.

## Commands

Run these before closing Studio work:

```bash
npm run lint -w @smx/studio
npm run typecheck -w @smx/studio
npm run test -w @smx/studio
npm run build -w @smx/studio
npm run audit:visual-debt -w @smx/studio
```

For visual changes also run:

```bash
npm run test:visual -w @smx/studio
```

## Visual rules

- Do not add inline styles unless they are already isolated and typed for dynamic layout constraints.
- Do not add `!important`.
- Do not add numeric `z-index` literals; use named tokens.
- Do not add raw color literals outside theme token files.
- Prefer token-driven fuchsia/violet/cyan accents for premium creative states.
- Keep green for success, amber for warnings, and red for blocking errors.
- Preserve keyboard navigation, visible focus, contrast, and icon labels.

## Architecture rules

- Keep Hub, Client Workspace, Editor, Inspector, Timeline, Library, and Widgets decoupled.
- Prefer extending existing primitives before inventing new ones.
- Do not mix large architectural refactors with visual redesign in the same change set.
- Keep widget surfaces split across definition, view-model, renderer, inspector, export, and style recipe when appropriate.
