# Studio Render Layer Tokenization Audit

Date: `2026-05-08`
Repo: `MandaRion`
Scope: `apps/studio`
Plan implemented against: `STUDIO-RENDER-LAYER-TOKENIZATION-PLAN-2026-05-08.md`

## Executive summary

This pass did **not** reach a literal-free state across every widget renderer, but it **did** convert the render-layer tokenization plan from convention into enforceable workflow:

- `theme.css` now contains additional reusable render-layer tokens for media text, scrims, light-card surfaces, slate neutrals, cyan accents, analytics panels, and card/flyout shadows.
- `widgets/modules/README.md` and `_template.renderer.tsx.example` now document the renderer tokenization contract.
- `scripts/lint-color-literals.mjs` is wired into Studio build/lint and actively guards opted-in tokenized renderers.
- `18` renderers now opt into the `render-tokenized` contract.
- Only `8` renderers remain outside the contract, concentrated in the heaviest residual widgets.

## What was implemented

### 1. Theme cleanup and shared token additions

Updated:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/theme.css`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/timeline.css`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/stage.css`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/platform.css`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/shared/styles/shell.css`

Relevant token families added or normalized:

- focus ladder canonicalization
- danger ladder consolidation
- media text tokens
- scrim gradients
- text-on-media shadows
- slate neutral tokens for light-card widgets
- light card / muted card surfaces
- analytics panel surface/text
- card/flyout shadow tokens
- cyan accent tokens used by small utility widgets

### 2. Lint guardrail for tokenized renderers

Added:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/scripts/lint-color-literals.mjs`

Updated:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/package.json`

Behavior:

- `npm run lint -w @smx/studio` now runs `lint:css` + `lint:colors`
- `npm run build -w @smx/studio` now runs the new lint flow before typecheck/build
- `lint:colors` scans only renderers that opt in with `// render-tokenized`
- inside opted-in files, generic `rgba(255,255,255,...)`, `rgba(0,0,0,...)`, and raw hex literals are forbidden unless they live inside `*BrandPalette` or are annotated as `// brand:`

This is intentionally incremental. It prevents regression in migrated files without breaking the rest of the repo, which still has legitimate defaults and visual literals outside the tokenized scope.

### 3. Documentation and template

Added/updated:

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/README.md`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/_template.renderer.tsx.example`

These now document:

- brand-vs-theme split
- allowed inline runtime geometry
- how to opt into the guardrail
- the recommended starting template for new renderers

### 4. Renderers migrated into the tokenized contract

The following renderers now include `// render-tokenized` and pass `lint:colors`:

- `add-to-calendar.renderer.tsx`
- `buttons.renderer.tsx`
- `drop-zone.renderer.tsx`
- `gen-ai-image.renderer.tsx`
- `image-carousel.renderer.tsx`
- `instagram-story.renderer.tsx`
- `interactive-video.renderer.tsx`
- `meta-carousel.renderer.tsx`
- `qr-code.renderer.tsx`
- `shoppable-sidebar.renderer.tsx`
- `speed-test.renderer.tsx`
- `step-indicator.renderer.tsx`
- `teads-layout1.renderer.tsx`
- `teads-layout2.renderer.tsx`
- `tiktok-video.renderer.tsx`
- `timer-bar.renderer.tsx`
- `travel-deal.renderer.tsx`
- `vertical-accordion.renderer.tsx`

### 5. Shared behavioral theme of the migrations

The migrated renderers now follow one of two patterns:

- **Generic widgets** use `var(--...)` tokens for chrome, surfaces, overlays, borders, and text.
- **Brand/mockup widgets** keep literals only inside explicit `*BrandPalette` objects.

This means a reviewer can now visually inspect many files and immediately distinguish:

- brand-justified literals
- theme-driven literals
- runtime values

## Current contract coverage

### Opted into `render-tokenized`

- `add-to-calendar.renderer.tsx`: `0` literal matches
- `buttons.renderer.tsx`: `0`
- `drop-zone.renderer.tsx`: `0`
- `gen-ai-image.renderer.tsx`: `0`
- `image-carousel.renderer.tsx`: `0`
- `instagram-story.renderer.tsx`: `2`
- `interactive-video.renderer.tsx`: `0`
- `meta-carousel.renderer.tsx`: `14`
- `qr-code.renderer.tsx`: `0`
- `shoppable-sidebar.renderer.tsx`: `0`
- `speed-test.renderer.tsx`: `11`
- `step-indicator.renderer.tsx`: `0`
- `teads-layout1.renderer.tsx`: `7`
- `teads-layout2.renderer.tsx`: `8`
- `tiktok-video.renderer.tsx`: `5`
- `timer-bar.renderer.tsx`: `0`
- `travel-deal.renderer.tsx`: `2`
- `vertical-accordion.renderer.tsx`: `7`

Interpretation:

- A non-zero count here is **not automatically debt**.
- For opted-in files, these remaining literals are expected to be in `*BrandPalette` blocks or other allowed brand-specific positions, because `lint:colors` already passed.

### Remaining renderers outside the contract

- `drag-token-pool.renderer.tsx`: `9`
- `dynamic-map.renderer.tsx`: `25`
- `form.renderer.tsx`: `5`
- `four-faces.renderer.tsx`: `10`
- `interactive-gallery.renderer.tsx`: `5`
- `interactive-hotspot.renderer.tsx`: `6`
- `particle-halo.renderer.tsx`: `2`
- `scratch-reveal.renderer.tsx`: `4`

Interpretation:

- This is the residual frontier.
- `dynamic-map` is by far the largest remaining hotspot.
- The rest are medium/small and could be finished in another cleanup pass without changing the guardrail design.

## What is intentionally not “fully closed”

### Not fully migrated yet

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/dynamic-map.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/four-faces.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/drag-token-pool.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/interactive-hotspot.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/interactive-gallery.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/form.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/scratch-reveal.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/particle-halo.renderer.tsx`

### Why they were left out

- to avoid broad, risky refactors in widgets with more runtime-specific visual logic
- to keep the guardrail honest and incremental instead of weakening it with excessive exceptions
- to finish the “easy and medium-safe” half of the plan first

## Validation run

All of these passed after the final pass:

- `npm run lint -w @smx/studio`
- `npm run lint:css -w @smx/studio`
- `npm run lint:colors -w @smx/studio`
- `npm run typecheck -w @smx/studio`
- `npm run test -w @smx/studio`
- `npm run build -w @smx/studio`

Observed final automated status:

- `55` test files passed
- `254` tests passed
- production build green

## Suggested next pass

If continuing this plan, the best next order is:

1. `dynamic-map.renderer.tsx`
2. `four-faces.renderer.tsx`
3. `drag-token-pool.renderer.tsx`
4. `interactive-hotspot.renderer.tsx`
5. `interactive-gallery.renderer.tsx`
6. `form.renderer.tsx`
7. `scratch-reveal.renderer.tsx`
8. `particle-halo.renderer.tsx`

## Audit checklist for another developer

### Check the contract itself

- inspect `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/scripts/lint-color-literals.mjs`
- confirm `package.json` runs `lint:colors` in `lint` and `build`
- read `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/README.md`
- read `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/_template.renderer.tsx.example`

### Check migrated examples

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/tiktok-video.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/instagram-story.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/interactive-video.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/image-carousel.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/shoppable-sidebar.renderer.tsx`

### Check the residual hotspots

- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/dynamic-map.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/four-faces.renderer.tsx`
- `/Users/enzocienfuegos/Documents/MandaRion/apps/studio/src/widgets/modules/drag-token-pool.renderer.tsx`

## Bottom line

This pass turned the render-layer tokenization effort into a **partially closed but enforceable system**:

- the contract exists
- the docs exist
- the lint exists
- the build enforces it
- `18` renderers are already inside it
- the remaining work is clearly bounded to `8` files

That is strong enough for audit and safe enough to keep iterating without reintroducing regressions.
