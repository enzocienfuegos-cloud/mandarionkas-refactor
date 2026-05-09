# Render Layer Tokenization

This folder treats widget renderers as a thin composition layer over shared design tokens.

## Rules

1. Keep brand literals inside a `*BrandPalette` object.
2. Route generic neutrals, overlays, shadows, and text colors through `theme.css` tokens with `var(--...)`.
3. Keep geometry and per-instance placement inline when they are genuinely runtime-driven.
4. Prefer shared `*.shared.ts` contracts for fallback copy, labels, and widget defaults that need to stay aligned across definition, renderer, inspector, and export.
5. If a renderer needs a new generic color or shadow, add it to `theme.css` instead of introducing a new local literal.

## Canonical Example

`tiktok-video.renderer.tsx` is the canonical reference for this pattern:

- `tiktokBrandPalette` keeps only TikTok-specific brand literals.
- Generic shell/background/scrim/text/shadow values come from `theme.css`.
- Runtime geometry and animation values stay inline where they depend on widget state.
- Tokenized renderers opt into the guardrail with `// render-tokenized: ...` at the top of the file.

## What Is Okay To Leave Inline

- `left`, `top`, `width`, `height`, `transform`, `opacity`, and similar per-instance geometry
- animation values derived from runtime state
- CSS custom properties used as data channels for animation or positioning

## What Should Not Be Reintroduced

- local grayscale palettes inside renderers
- repeated `rgba(...)` scrims for generic overlays
- duplicate fallback copy across definition, renderer, inspector, and export layers

## Lint Guardrail

`npm run lint:colors -w @smx/studio` scans renderers that opt in with the
`render-tokenized` file comment. In those files:

- generic `rgba(255,255,255,...)` and `rgba(0,0,0,...)` are forbidden
- hex literals are forbidden outside `*BrandPalette` blocks and `// brand:` lines

Use the opt-in comment once the renderer follows the pattern cleanly.
