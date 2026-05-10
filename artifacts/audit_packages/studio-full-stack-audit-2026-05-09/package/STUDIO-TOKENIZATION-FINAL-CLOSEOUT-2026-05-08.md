# Studio Tokenization Closeout — Final Pass for CODEX

> **Audience**: CODEX, executing against `apps/studio`.
> **Why**: After the 2026-05-08 closeout, 4 items remain to fully close the render-layer tokenization plan. Three are polish (≤30 min each). One is the sprint-sized migration of 8 residual renderers.
> **Status**: 18/22 active renderers are tokenized and lint-protected. This pass closes the remaining gap.
> **Total scope if all four are done**: 1 sprint (~3 days). If only the polish trio is done: 1 hour.

---

## Conventions

- **Severity**: 🟠 should-do / 🟡 polish / 🟢 nice-to-have
- **Effort**: XS (≤15 min), S (≤2h), M (half-day), L (full day)
- All paths are relative to `apps/studio/` unless noted otherwise
- Every change must keep `npm run lint -w @smx/studio` (which now runs both `lint:css` and `lint:colors`), `npm run typecheck`, `npm run test`, and `npm run build` green

---

## Phase index

- **Phase Z — polish** (1 hour total, do first): Z1, Z2, Z3
- **Phase W — final widget migration** (1 sprint): W1

---

# Z1 — Add `// render-tokenized` to clean residual renderers

**Severity**: 🟠 should-do · **Effort**: XS · **Surface**: widgets

## Context

The closeout audit listed 8 renderers outside the tokenized contract. The repo actually has **13** renderers without `// render-tokenized`. The 5 omitted from the audit are:

```
countdown.renderer.tsx
slider.renderer.tsx
weather-conditions.renderer.tsx
range-slider.renderer.tsx
modules.renderer.tsx          (legacy retired, ignore — only contains `export {};`)
```

The first 4 each have **0 hex/rgba literals** verified by grep. They are clean but unprotected — a future PR could introduce literals into them without `lint:colors` flagging anything.

**Skip `modules.renderer.tsx`** — it's a legacy retired stub from Sprint 44 (`export {};`).

## Fix

For each of the 4 clean renderers, add the opt-in marker as the first line of the file.

```bash
cd apps/studio
for f in countdown.renderer.tsx slider.renderer.tsx weather-conditions.renderer.tsx range-slider.renderer.tsx; do
  path="src/widgets/modules/$f"
  # Sanity check: confirm 0 literals before adding the marker
  count=$(grep -cE "#[0-9a-fA-F]{3,8}\b|rgba?\(" "$path")
  if [ "$count" != "0" ]; then
    echo "ABORT: $f has $count literals — should NOT add marker without first migrating"
    continue
  fi
  # Prepend marker
  echo -e "// render-tokenized: brand/theme split enforced by lint-color-literals.mjs\n$(cat "$path")" > "$path"
  echo "Marked: $f"
done
node scripts/lint-color-literals.mjs && echo "✓ lint:colors still passes"
```

## Acceptance criteria

- `grep -rln "render-tokenized" src/widgets/modules/ --include="*.tsx" | wc -l` returns **22** (up from 18).
- `node scripts/lint-color-literals.mjs` exits 0.
- `npm run typecheck` and `npm run test` continue to pass.

## Notes

If any of those 4 files turns out to have a literal that the count missed (e.g., inside a string template `\`#${variable}\``), don't force the marker. Migrate the literal first (Phase W pattern), then add the marker.

---

# Z2 — Clean up `metaCarouselBrandPalette`

**Severity**: 🟡 polish · **Effort**: XS · **Surface**: widgets, theme

## Context

`meta-carousel.renderer.tsx` has the largest `BrandPalette` of any tokenized renderer with **13 entries**. Three of those are not actually brand-justified — they are generic neutrals smuggled into the palette to bypass the lint:

```ts
// CURRENT
const metaCarouselBrandPalette = {
  border: '#e4e6eb',                                  // Facebook-specific gray ✓ brand
  avatarGradient: 'linear-gradient(...)',             // brand
  primaryText: '#050505',                             // FB primary text ✓ brand-defensible
  secondaryText: '#65676b',                           // FB secondary text ✓ brand-defensible
  surface: '#fff',                                    // ✗ NOT brand — generic white
  fallbackSurface: '#e4e6eb',                         // duplicate of `border`
  ctaBorder: '#d0d5dd',                               // FB-specific gray ✓ brand-defensible
  ctaSurface: '#f0f2f5',                              // FB-specific gray ✓ brand-defensible
  dotActive: '#1877f2',                               // Facebook blue ✓ brand
  dotInactive: '#c8ccd0',                             // FB-specific gray ✓ brand-defensible
  shadowSoft: '0 1px 3px rgba(0,0,0,0.12)',           // ✗ NOT brand — generic shadow
  shadowMed: '0 2px 6px rgba(0,0,0,0.15)',            // ✗ NOT brand — generic shadow
  placeholderTint: '#b0b8c1',                         // FB-specific gray ✓ brand-defensible
};
```

The lint passes because these are inside `BrandPalette`, but the spirit of the convention is being stretched. If a junior dev reads this file, they learn "putting `#fff` and shadows in BrandPalette is OK" — and the pattern compounds.

## Fix

**Step 1 — Add two new shadow tokens to `theme.css`.**

Add to the shadow section of `theme.css`:

```css
/* Shadow tokens for floating cards on light surfaces (carousel cards, etc.) */
--shadow-card-elev1: 0 1px 3px var(--black-a-12);
--shadow-card-elev2: 0 2px 6px var(--black-a-15);
```

Verify `--black-a-12` and `--black-a-15` already exist (they do per the post-closeout theme audit).

**Step 2 — Migrate the renderer.**

In `src/widgets/modules/meta-carousel.renderer.tsx`:

```ts
const metaCarouselBrandPalette = {
  border: '#e4e6eb',
  avatarGradient: 'linear-gradient(135deg,#1877f2,#42b883)',
  primaryText: '#050505',
  secondaryText: '#65676b',
  fallbackSurface: '#e4e6eb',
  ctaBorder: '#d0d5dd',
  ctaSurface: '#f0f2f5',
  dotActive: '#1877f2',
  dotInactive: '#c8ccd0',
  placeholderTint: '#b0b8c1',
} as const;
// Removed: surface, shadowSoft, shadowMed
```

Then in the style consts that referenced the removed entries, swap to theme tokens:

```ts
// BEFORE
background: metaCarouselBrandPalette.surface,
boxShadow: metaCarouselBrandPalette.shadowSoft,
boxShadow: metaCarouselBrandPalette.shadowMed,

// AFTER
background: 'var(--surface-card-light)',
boxShadow: 'var(--shadow-card-elev1)',
boxShadow: 'var(--shadow-card-elev2)',
```

`--surface-card-light` already exists in `theme.css` (verified value: `#ffffff`).

**Step 3 — Verify visual diff.**

Add a Meta Carousel widget to a canvas. Before-and-after screenshot. The card surfaces and shadows should look identical (the values are 1:1 — `var(--surface-card-light)` resolves to `#ffffff`, and the new shadow tokens have alpha values 0.12/0.15 matching the original literals).

## Acceptance criteria

- `metaCarouselBrandPalette` has **10 entries** (down from 13). All remaining entries reference Facebook-specific colors.
- `--shadow-card-elev1` and `--shadow-card-elev2` exist in `theme.css` and are used in `meta-carousel.renderer.tsx`.
- `node scripts/lint-color-literals.mjs` exits 0.
- Visual diff of the rendered Meta Carousel widget: identical.
- New tokens are used in **at least one place** (this renderer). If only used here, that's acceptable for now — Z2 doesn't need to enforce the "≥3 places" rule from the original plan, since these shadow values match a common card-elevation pattern that other renderers (e.g., `instagram-story` in future migrations) will likely reuse.

---

# Z3 — Fix the renderer template

**Severity**: 🟡 polish · **Effort**: XS · **Surface**: documentation

## Context

`src/widgets/modules/_template.renderer.tsx.example` line 8-9:

```ts
const exampleBrandPalette = {
  primary: '#000000',
  secondary: '#ffffff',
} as const;
```

This is the **wrong lesson**. `#000` and `#fff` are generic neutrals, not brand colors. A developer copying this template learns "putting white and black in BrandPalette is OK" — which is exactly the pattern that produced Z2.

## Fix

Update the template to use **realistic brand-color examples** and a body that demonstrates the brand-vs-theme split.

```tsx
// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import type { CSSProperties } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { moduleShell } from './shared-styles';

// Brand palette — only colors that reproduce a real-world brand.
// Replace these with the actual brand values for the widget you are building.
// White, black, and generic grays do NOT belong here — use theme tokens instead.
const exampleBrandPalette = {
  // Example values shown for a TikTok-style widget. Substitute with the brand
  // your renderer is simulating.
  brandAccent: '#fe2c55',
  brandSecondary: '#25f4ee',
} as const;

// Shell uses theme tokens. No literals here.
const exampleChromeStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'var(--surface-card-light)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-on-media-strong)',
  boxShadow: 'var(--shadow-card-elev1)',
};

function buildExampleShellStyle(node: WidgetNode, ctx: RenderContext): CSSProperties {
  return {
    ...moduleShell(node, ctx),
    overflow: 'hidden',
    background: 'var(--bg-deep)',
  };
}

export function ExampleRenderer({
  node,
  ctx,
}: {
  node: WidgetNode;
  ctx: RenderContext;
}): JSX.Element {
  return (
    <div style={buildExampleShellStyle(node, ctx)}>
      {/* Surface and chrome use theme tokens */}
      <div style={exampleChromeStyle}>Replace this with widget content.</div>

      {/* Brand accent comes from the brand palette */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 12,
          padding: '4px 8px',
          color: 'var(--text-on-media-strong)',           // theme: text on media
          background: exampleBrandPalette.brandAccent,    // brand: accent color
          borderLeft: `3px solid ${exampleBrandPalette.brandSecondary}`,  // brand: secondary
          borderRadius: 'var(--radius-sm)',
        }}
      >
        Brand colors highlight; theme tokens carry surface and chrome.
      </div>
    </div>
  );
}
```

Note: the example uses `--shadow-card-elev1` from Z2, so Z3 should ideally land **after** Z2 (or in the same PR). If Z2 is not done yet, swap to `--shadow-floating-soft` which already exists.

## Acceptance criteria

- The template no longer contains `'#000000'`, `'#ffffff'`, or any generic neutrals in `exampleBrandPalette`.
- The `exampleBrandPalette` entries are commented as example brand values (e.g., TikTok pink/cyan).
- The body demonstrates the split: theme tokens for chrome and surface, brand palette for accents.
- The template still passes `node scripts/lint-color-literals.mjs` (it has the opt-in marker).

---

# W1 — Migrate the remaining 8 widget renderers

**Severity**: 🟠 should-do · **Effort**: L (full sprint, ~3 days) · **Surface**: widgets

## Context

After Z1, the contract covers 22 renderers. 8 remain:

| Renderer | Literals | Estimated effort | Brand?  |
|---|---|---|---|
| `particle-halo.renderer.tsx` | 2 | XS (15 min) | unlikely |
| `scratch-reveal.renderer.tsx` | 4 | XS (30 min) | unlikely |
| `form.renderer.tsx` | 5 | S (1h) | unlikely |
| `interactive-gallery.renderer.tsx` | 5 | S (1h) | unlikely |
| `interactive-hotspot.renderer.tsx` | 6 | S (1h) | unlikely |
| `drag-token-pool.renderer.tsx` | 8 | S (1.5h) | unlikely |
| `four-faces.renderer.tsx` | 9 | M (2h) | YES (Bocadeli World Cup) |
| `dynamic-map.renderer.tsx` | 21 | M-L (3-4h) | partial (Waze, Google Maps) |

**Total: ~13 hours of focused work, spread over ~3 days for visual diff between each.**

## Recommended sprint order

Migrate from smallest to largest. This trains the pattern on low-risk files first, then tackles the heavyweight last when you're fluent in the migration motion.

### Day 1 — Small batch (4 files, ~3 hours)

1. `particle-halo.renderer.tsx` (2 literals)
2. `scratch-reveal.renderer.tsx` (4)
3. `form.renderer.tsx` (5)
4. `interactive-gallery.renderer.tsx` (5)

### Day 2 — Medium batch (3 files, ~5 hours)

5. `interactive-hotspot.renderer.tsx` (6)
6. `drag-token-pool.renderer.tsx` (8)
7. `four-faces.renderer.tsx` (9 — has brand colors, see below)

### Day 3 — Heavyweight (1 file, ~4 hours)

8. `dynamic-map.renderer.tsx` (21 — Leaflet caveats, see below)

## Migration procedure (apply per file)

This is identical to G1/G2 from the original plan. Concise version:

**Step 1 — Read the file.** Identify every hex/rgba literal.

**Step 2 — Classify each literal into one of three buckets**:

- **BRAND**: reproduces a real-world brand identity (Bocadeli red, Waze blue, Google Maps red). Goes into `<widget>BrandPalette`.
- **THEME**: generic neutral or shadow that should map to `var(--*)`. Migrate to existing theme token, or propose new one if needed.
- **RUNTIME**: depends on user input or animation state. Stays inline as `style={...}`.

**Step 3 — Migrate**:

1. Create `<widget>BrandPalette` const at top of file (only if there are brand literals).
2. Replace each non-brand literal with the appropriate `var(--*)` reference.
3. If a needed token doesn't exist, add it to `theme.css` first, then use it.
4. Add `// render-tokenized: brand/theme split enforced by lint-color-literals.mjs` as the first line.

**Step 4 — Verify**:

```bash
node scripts/lint-color-literals.mjs    # must exit 0
npm run typecheck -w @smx/studio        # must pass
```

**Step 5 — Visual diff**:

1. Start `npm run dev`.
2. Add the widget to a canvas before changes (or revert one file at a time).
3. Screenshot.
4. Apply migration.
5. Reload, screenshot.
6. Compare. They must be visually identical (or any drift is documented and acceptable — e.g., rounding `0.30` to `var(--white-a-28)` which is `0.28`).

**Step 6 — Commit per file.** Atomic commits make rollback safe if one file regresses.

## File-specific guidance

### `particle-halo.renderer.tsx` (2 literals)

Likely 0 brand colors. Probably both literals are generic (a glow color, a particle color). Read first. If both are generic neutrals, no `BrandPalette` is needed at all — just migrate to theme tokens directly.

If the glow has a specific accent color that's intentionally not theme-aligned (e.g., `'#ff00ff'` for a magenta particle effect), it may belong in a tiny `particleHaloBrandPalette` with one entry.

### `scratch-reveal.renderer.tsx` (4 literals)

Likely all generic — scratch overlay is gray-tones. Migrate fully to theme tokens. No `BrandPalette` needed.

### `form.renderer.tsx` (5 literals)

Form fields, validation states. All theme-driven. Likely no brand. Use:
- `var(--surface-card-light)` for input backgrounds
- `var(--border-subtle)` for borders
- `var(--text-danger-soft)` for validation errors
- `var(--accent-a-45)` for focus rings (or `--focus-a-*`)

### `interactive-gallery.renderer.tsx` (5 literals)

Gallery chrome. Likely all theme. Reuse `--scrim-top-strong`, `--scrim-bottom-strong`, `--text-on-media-*`.

### `interactive-hotspot.renderer.tsx` (6 literals)

Hotspot dots and tooltips. Likely all theme. The accent dot color may be `var(--accent-2)` or similar.

### `drag-token-pool.renderer.tsx` (8 literals)

Drag tokens. Read first to see if any token represents a brand. If it's a generic drag-and-drop UI, all migrate to theme.

### `four-faces.renderer.tsx` (9 literals) — HAS BRAND

Bocadeli World Cup banner. Brand colors of the campaign. Specific guidance:

- Bocadeli brand colors (likely red/yellow/blue) → `fourFacesBrandPalette`
- Generic shadows, neutrals → theme tokens
- The 4-face cube animation logic stays inline (runtime)

Verify against the campaign brand spec before deciding which colors are brand. If unsure which colors are brand, **err on the side of putting them in `BrandPalette` with a comment** — better to over-classify than to break the campaign visual.

### `dynamic-map.renderer.tsx` (21 literals) — HEAVYWEIGHT

Largest residual. Specific guidance:

**Brand colors**: Waze blue (`#33ccff` or similar), Google Maps red marker color, OpenStreetMap green if used. Confirm against the renderer's actual usage.

**Leaflet caveat**: Leaflet imports its own CSS that uses `!important` in places. Marker popups render in a DOM context where `var(--*)` should resolve normally (they're not iframes), but if you find a `var()` not rendering, the cause is likely a Leaflet `!important` override. Solution:
1. Add a higher-specificity selector in `src/shared/styles/widgets-dynamic-map.css` (create the file if needed).
2. Or annotate the original literal with `// brand: leaflet-popup-override` so the lint allows it.

**Map controls** (zoom buttons, attribution): those have Leaflet's own classes. Don't migrate — they're not in our renderer's scope.

**Marker SVG fills**: if any inline SVG has `fill="#XXXXXX"`, migrate per Bucket THEME unless it's a brand-specific marker color (e.g., a custom Bocadeli pin).

**Procedure for dynamic-map**:

1. First, do a literal classification pass: list all 21 hex/rgba and assign each to BRAND/THEME/RUNTIME without writing any code yet. Document this list in the PR description.
2. Migrate the THEME ones first (smaller risk, larger volume).
3. Migrate the BRAND ones into `dynamicMapBrandPalette`.
4. RUNTIME stays inline.
5. Visual diff with a sample map widget on the canvas. Pan, zoom, click markers, verify popups.

## Aggregate acceptance criteria for W1

After all 8 files are migrated:

- `grep -rln "render-tokenized" src/widgets/modules/ --include="*.tsx" | wc -l` returns **30** (all active renderers; `modules.renderer.tsx` is retired).
- `node scripts/lint-color-literals.mjs` exits 0 and scans 30 files.
- `grep -rcE '#[0-9a-fA-F]{3,8}\b|rgba?\(' src/widgets/modules/ --include="*.tsx" 2>/dev/null | awk -F: '{s+=$2} END {print s}'` — total literals across all renderers, expected to be **≤ 80** (down from current ~134), all inside `BrandPalette` blocks or `// brand:` annotations.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` all pass.
- Visual smoke test: every migrated widget added to a canvas renders identically to its pre-migration state.

## What to do if you get stuck

If a literal doesn't fit any bucket cleanly:

- **Genuinely brand?** Put it in `BrandPalette` with a comment explaining the brand.
- **Generic but no token matches?** Propose a new token in `theme.css` and use it. The "≥3 usages" rule from the original plan can be relaxed for this final pass — sometimes a new token only has one user, and that's still better than a hardcoded literal.
- **Runtime-derived?** Stay inline. Don't force it into a const.
- **Inside a string template that mixes runtime and literal?** Refactor:
  ```ts
  // BEFORE
  background: `linear-gradient(135deg, #ff0000, ${dynamicColor})`;
  // AFTER
  background: `linear-gradient(135deg, ${someBrandPalette.primary}, ${dynamicColor})`;
  ```

If you can't classify after 10 minutes of looking at it, **leave the literal**, add `// brand: needs-review` above it, and flag it in the PR. A reviewer will resolve it.

---

# Sequencing recommendation

| When | Items | Effort | Outcome |
|---|---|---|---|
| **Today** | Z1 + Z2 + Z3 | 1 hour | Guardrail covers 22 renderers. Template teaches correct pattern. Meta-carousel cleaned. |
| **Sprint S+N** | W1 | 1 sprint | All 30 active renderers tokenized. "0 hardcodes outside BrandPalette" becomes empirically true. |

The Z items (polish trio) should land together in one PR. They're independent in code but related in intent — the 1-hour PR description writes itself: *"Final polish on tokenization guardrail. Z1 closes the opt-in gap (4 clean files protected). Z2 cleans `metaCarouselBrandPalette` (3 generic neutrals moved to theme). Z3 fixes the template to teach the correct brand-vs-theme split."*

W1 can ship as 3 separate PRs (one per day batch), or as one large PR with separate commits per file. Atomic commits per file are recommended either way for rollback safety.

---

# Sanity checklist for CODEX

Before opening a PR for any item:

- [ ] Read the linked source files in their **current** form. Files may have evolved.
- [ ] Re-verify literal counts with grep before claiming the migration starting point.
- [ ] For Z2 and W1: take before/after screenshots of every widget you modify, on a canvas. Attach to PR.
- [ ] Run `npm run lint` (covers both `lint:css` and `lint:colors`), `npm run typecheck`, `npm run test`, `npm run build`.
- [ ] In the PR description, list:
  - For each migrated file: how many literals moved to theme, how many stayed in BrandPalette, and the brand justification for each remaining.
  - Any new tokens added to `theme.css` and where they are used.
- [ ] One commit per file. Atomic.

---

# Final verification command

After W1 completes, run this to confirm the closeout:

```bash
cd apps/studio

# 1. All active renderers are opted-in
echo "Renderers with opt-in marker:"
grep -rln "render-tokenized" src/widgets/modules/ --include="*.tsx" | wc -l
# Expected: 30

# 2. Lint guard passes
node scripts/lint-color-literals.mjs && echo "✓ lint:colors clean"

# 3. Total literals are bounded
echo "Total hex/rgba literals across renderers:"
grep -rcE '#[0-9a-fA-F]{3,8}\b|rgba?\(' src/widgets/modules/ --include="*.tsx" 2>/dev/null \
  | awk -F: '{s+=$2} END {print s}'
# Expected: ≤ 80, all inside BrandPalette or // brand: lines

# 4. Build succeeds end-to-end
npm run build -w @smx/studio
```

If all 4 outputs are clean, the render-layer tokenization plan is **fully closed and empirically protected against regression**.

---

*End of plan.*
