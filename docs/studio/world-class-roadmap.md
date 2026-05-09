# Studio World-Class Roadmap

## Current priorities

The active refactor order is driven by the 2026-05-09 Studio audit and the v2 world-class plan.

Top impact areas:

1. Close stage/export divergence with shared token and contract work.
2. Break down rich-media monoliths, starting with the largest widget modules.
3. Modularize export runtime and enforce runtime budgets.
4. Move client-specific starters into a reusable template library.
5. Improve designer-facing product UX, not only internal code structure.

## Execution blocks

### Block 0

- Establish permanent repo guidance in `AGENTS.md`
- Document architecture and roadmap
- Add measurable debt reporting via `audit-visual-debt.mjs`
- Remove tenancy leaks from shell-level code
- Start token unification for export

### Block 1

- Create explicit schema, migration, and parity foundations before broad refactors
- Tighten registry contracts and stage/export boundaries

### Block 2

- Decompose heavyweight widgets such as `dynamic-map`, `four-faces`, `tiktok-video`, `vertical-accordion`, and `meta-carousel`

### Block 3

- Split `runtime-script.ts` into modular runtime fragments and enforce budgets

### Block 4

- Add Brand Kit, template workflows, and variant-generation foundations

### Block 5

- Improve DX and visual QA so new widget work remains scalable

### Block 6

- Final performance, polish, and release-readiness hardening

## Reference hotspots

- `apps/studio/src/canvas/stage/Stage.tsx`
- `apps/studio/src/export/runtime-script.ts`
- `apps/studio/src/widgets/modules/export-renderers.ts`
- `apps/studio/src/widgets/modules/dynamic-map.renderer.tsx`
- `apps/studio/src/widgets/modules/four-faces.renderer.tsx`

## Validation baseline

Every Studio change should end with:

```bash
npm run lint -w @smx/studio
npm run typecheck -w @smx/studio
npm run test -w @smx/studio
npm run build -w @smx/studio
```
