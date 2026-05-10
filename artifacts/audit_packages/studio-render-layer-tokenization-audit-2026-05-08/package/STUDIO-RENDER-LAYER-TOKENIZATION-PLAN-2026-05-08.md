# Studio Render Layer Tokenization — Plan for CODEX

> **Audience**: CODEX (the coding agent that will execute this against `apps/studio`).
> **Why this exists**: After the hardcode closeout (2026-05-08), the editor shell is fully tokenized. Widget renderers still hold ~376 `hex/rgba` literals across 14 files. This plan separates **brand-justified** literals (which stay) from **generic theme** literals (which migrate to CSS variables), and trims the remaining stragglers in `theme.css`.
> **Total scope**: 3 sprints. This is **NOT** required to ship product. Do it when polish capacity exists.
> **What this is NOT**: a refactor of widget logic, animation, or layout. Geometry and runtime values stay inline as `style={...}`. Only color/opacity/shadow/gradient literals are in scope.

---

## Conventions

- **Severity**: 🟠 should-do / 🟡 polish / 🟢 nice-to-have
- **Effort**: XS (≤30 min), S (≤2h), M (half-day), L (full day), XL (multi-day)
- All paths are relative to `apps/studio/src/` unless noted otherwise
- Every change must keep `npm run lint:css -w @smx/studio`, `npm run typecheck -w @smx/studio`, `npm run test -w @smx/studio`, and `npm run build -w @smx/studio` green
- **Use the residual budget as the goal post**, not zero. The goal is "every literal in this codebase is brand-justified or runtime-justified, and the reader can tell which is which."

---

## Phase index

- **Phase F — Theme cleanup leftovers** (1 day, do first): F1, F2
- **Phase G — Widget palette taxonomy** (2 sprints, the bulk of the work): G1, G2, G3
- **Phase H — Future-proofing** (optional polish): H1, H2

---

## Operating rules CODEX must follow

These are non-negotiable. Violating any of them produces a regression.

### Rule 1 — The brand/theme distinction

Every hex/rgba literal in a widget renderer falls into exactly one of three buckets. CODEX must classify each before touching it.

**Bucket BRAND** — keep as literal, in a `palette` const at the top of the renderer.
- A color that reproduces a real-world brand (TikTok pink `#fe2c55`, Instagram gradient stops, WhatsApp green, Spotify green).
- A color that is part of a templated UI mockup (the dark-blue gradient of TikTok shell `#1a1a2e/#16213e/#0f3460`).
- A color that, if changed, would make the widget visually wrong as a brand simulation.

**Bucket THEME** — migrate to a `var(--*)` from `theme.css`. If the variable does not exist yet, propose adding it.
- Generic neutrals: `#fff`, `#000`, `#888`, `#333`, `#222`, `#111`, `#666`, `#444`.
- Generic transparent overlays on white or black: `rgba(255,255,255,0.5)`, `rgba(0,0,0,0.4)`. These should map to `--white-a-*` and `--black-a-*`.
- Generic shadow values: `0 1px 3px rgba(0,0,0,0.5)`, `0 4px 12px rgba(0,0,0,0.2)`. Use existing `--shadow-*` tokens or add semantic ones.

**Bucket RUNTIME** — leave inline as `style={...}`. No change.
- `aspectRatio`, `width`, `height` computed from props/data
- `transform: translate(...)`, `opacity` from animation state
- `backgroundImage: url(...)` from asset URLs
- Any value that depends on user input or dynamic state

### Rule 2 — Bundle exporters are out of scope

Files in `widgets/modules/export-renderers.ts` and any `*.export.ts` produce **HTML strings that ship inside ad bundles**. That HTML runs in third-party ad placements (Criteo, Adform, GAM) where the Studio CSS theme is **not loaded**. CSS variables there resolve to nothing. **Do not migrate literals in export pipelines.** They must stay literal so the exported ad renders in a clean placement context.

The 50 literals in `widgets/modules/export-renderers.ts` are out of scope. So is anything else that returns HTML strings to be embedded in third-party pages.

### Rule 3 — Token additions go through theme.css

If you find a generic neutral that doesn't have a matching token, **add the token to theme.css** rather than hardcoding it locally. Examples of tokens that may be missing today and worth proposing:

- `--ink-on-media-strong: rgba(255, 255, 255, 0.95)` — for white text over media
- `--ink-on-media-soft: rgba(255, 255, 255, 0.75)` — for secondary text over media
- `--scrim-media-soft: rgba(0, 0, 0, 0.4)` — for the dark overlay on hero images
- `--scrim-media-strong: rgba(0, 0, 0, 0.6)` — for stronger video bottom gradients
- `--shadow-text-on-media: 0 1px 3px rgba(0, 0, 0, 0.5)` — text shadow over photography

Propose new tokens by editing `theme.css` and noting in the PR description: "Added `--scrim-media-soft` to support widget renderer migration." Do not add a new token without using it in at least 3 places.

### Rule 4 — Per-widget palette consts stay legitimate

Every widget renderer that does brand simulation can keep a `palette` const for its **brand-justified** literals only. Example acceptable end state for `tiktok-video.renderer.tsx`:

```ts
// Brand-justified: TikTok visual identity. Do not migrate to theme tokens.
const tiktokBrandPalette = {
  pink: '#fe2c55',
  cyan: '#25f4ee',
  shellGradient: 'linear-gradient(180deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)',
} as const;

// Theme tokens for non-brand surfaces. Use var() in styles, not literals.
// (no const needed — referenced as `var(--white-a-95)` etc. directly in style objects)
```

Any literal in the renderer that is not in `brandPalette` should be a `var(--*)`. A literal outside `brandPalette` is treated as a regression.

### Rule 5 — Visual regression is the only acceptance test that matters

Each widget renderer touched must be visually compared before/after. A pixel-diff via screenshot or a manual side-by-side. CSS variable resolution introduces no functional difference — but if a variable resolves to a slightly different value than the literal it replaces, the diff catches it.

For each renderer in scope:
1. Start the dev server.
2. Add the widget to the canvas before changes. Screenshot.
3. Apply the migration.
4. Reload the canvas. Screenshot.
5. Diff. They must be identical (or, if a token introduced a small drift, document it and confirm the drift is correct/intentional).

---

# Phase F — Theme cleanup leftovers

These are small follow-ups from R4 (transparency token cleanup) that didn't reach the full target.

---

## F1 — Trim `--focus-a-*` to canonical ladder

**Severity**: 🟢 nice-to-have · **Effort**: S · **Surface**: theme

### Context

After R4, `--white-a-*` was reduced from 32 to 17 tokens (target was ≤16 stretch / ≤20 cómodo, achieved). But `--focus-a-*` still has 10 tokens with oddballs that don't fit the canonical ladder:

```
--focus-a-06   --focus-a-08   --focus-a-14   --focus-a-18   --focus-a-24
--focus-a-28   --focus-a-34   --focus-a-36   --focus-a-40   --focus-a-68
```

The canonical ladder defined in the docblock at `theme.css` lines 55–62 is `01, 02, 03, 04, 06, 08, 12, 18, 24, 28, 35, 45, 55, 62, 75, 85, 90, 95`. The oddballs are `-14`, `-34`, `-36`, `-40`, `-68`.

Each oddball is used 2–4 times across the codebase (verified: `--focus-a-34: 4 uses`, `-36: 4 uses`, `-40: 4 uses`, `-68: 2 uses`). Low usage → safe to consolidate.

### Fix

For each oddball, replace usages with the nearest canonical token, then delete the oddball from `theme.css`:

| Remove | Replace with | Reason |
|---|---|---|
| `--focus-a-14` | `--focus-a-12` | nearest down |
| `--focus-a-34` | `--focus-a-35` | round to ladder |
| `--focus-a-36` | `--focus-a-35` | round to ladder |
| `--focus-a-40` | `--focus-a-45` | nearest up |
| `--focus-a-68` | `--focus-a-62` | nearest down |

**Procedure** for each:
1. `rg "var\(--focus-a-34\)" src/` — find usages.
2. Replace each with the chosen canonical equivalent.
3. Visual diff the affected components (focus rings, accent halos).
4. Once no usages remain, delete the variable definition from `theme.css`.

### Acceptance criteria

- `grep -oE -- "--focus-a-[0-9]+" src/shared/theme.css | sort -u | wc -l` returns **5** (down from 10): `06, 08, 12, 18, 24, 28, 35, 45, 62`.
- Wait — that's 9 if you count `35, 45, 62`. Adjust the target: **≤ 9 tokens**.
- `npm run lint:css -w @smx/studio` passes.
- Focus-ring screenshots before/after on Save button, Inspector input, IconButton: identical to the eye.

### Out of scope

`--accent-a-22` exists alongside `--accent-a-24` — both are valid stops on the canonical ladder (12, 22, 24, 28, ...). Don't remove either unless usage is genuinely 0.

---

## F2 — Trim `--danger-a-*` adjacency

**Severity**: 🟢 nice-to-have · **Effort**: XS · **Surface**: theme

### Context

`--danger-a-32` and `--danger-a-34` are adjacent (2-point delta) and likely a duplicate decision. Remove one.

### Fix

Check usage:

```bash
cd apps/studio
for var in danger-a-32 danger-a-34; do
  count=$(rg --no-heading -- "--$var" src --count-matches 2>/dev/null | awk '{s+=$0} END {print s}')
  echo "$var: $count"
done
```

Whichever has lower usage, replace its usages with the higher-usage one and delete it. If both are used roughly equally, keep `-32` (rounder number, easier to remember as "32% danger") and consolidate `-34` into `-32`.

### Acceptance criteria

- Only one of `--danger-a-32` or `--danger-a-34` exists in `theme.css`.
- All usages of the removed variable have been replaced.
- Visual diff of error states (toast danger, validation messages, danger buttons): identical.

---

# Phase G — Widget palette taxonomy

The big work. Per-widget renderer migration. Sprint by sprint, two waves.

---

## G1 — Establish the brand-vs-theme convention with one canonical migration

**Severity**: 🟠 should-do (do this first to set the pattern) · **Effort**: M · **Surface**: widgets/modules

### Context

Before migrating 14 renderers, do **one** carefully so the pattern is unambiguous for the rest. `tiktok-video.renderer.tsx` is the right candidate because:

1. It has both clear brand colors (TikTok pink/cyan) and clear generic neutrals (`#fff`, `#888`, `rgba(0,0,0,0.5)`).
2. It is one of the most-used widgets, so the test surface is real.
3. It is a known hotspot (40 inline `style=`, 23 hex/rgba literals).
4. The closeout audit already noted it.

### Fix — concrete migration of `tiktok-video.renderer.tsx`

**Step 1 — Classify every literal in the current `tiktokPalette` const (lines 17–41 of the renderer).**

```ts
// CURRENT (post-closeout)
const tiktokPalette = {
  white: '#fff',                                                          // → THEME
  black: '#000',                                                          // → THEME
  blackSoft: '#111',                                                      // → THEME (or kept if specific)
  gray800: '#333',                                                        // → THEME
  gray700: '#222',                                                        // → THEME
  gray500: '#888',                                                        // → THEME
  tiktokPink: '#fe2c55',                                                  // → BRAND (keep)
  tiktokCyan: '#25f4ee',                                                  // → BRAND (keep)
  shellGradient: 'linear-gradient(180deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)',  // → BRAND (keep)
  topGradient: 'linear-gradient(to bottom,rgba(0,0,0,0.5) 0%,transparent 100%)', // → THEME (refactor as gradient using --black-a-50)
  bottomGradient: 'linear-gradient(to top,rgba(0,0,0,0.75) 0%,transparent 100%)',// → THEME
  mutedWhite35: 'rgba(255,255,255,0.35)',                                 // → THEME → var(--white-a-35)
  mutedWhite90: 'rgba(255,255,255,0.9)',                                  // → THEME → var(--white-a-90)
  mutedWhite75: 'rgba(255,255,255,0.75)',                                 // → THEME → var(--white-a-75)
  mutedWhite30: 'rgba(255,255,255,0.3)',                                  // → THEME → var(--white-a-28) (round to ladder)
  mutedWhite20: 'rgba(255,255,255,0.2)',                                  // → THEME → var(--white-a-18) (round to ladder)
  mutedWhite80: 'rgba(255,255,255,0.8)',                                  // → THEME → var(--white-a-85) (round to ladder)
  blackOverlay50: 'rgba(0,0,0,0.5)',                                      // → THEME → var(--black-a-50) (verify exists)
  blackOverlay40: 'rgba(0,0,0,0.4)',                                      // → THEME → var(--black-a-40) (verify exists)
  blackOverlay30: 'rgba(0,0,0,0.3)',                                      // → THEME → var(--black-a-28) (round to ladder)
  shadowSoft: '0 1px 3px rgba(0,0,0,0.5)',                                // → THEME → var(--shadow-text-on-media-soft) (propose new)
  shadowMedium: '0 1px 4px rgba(0,0,0,0.5)',                              // → THEME → var(--shadow-text-on-media-medium) (propose new)
  shadowText: '0 1px 4px rgba(0,0,0,0.4)',                                // → THEME → var(--shadow-text-on-media-light) (propose new)
} as const;
```

**Step 2 — Verify which `--black-a-*` and `--white-a-*` tokens already exist in theme.css.**

Required tokens for this migration:
- `--white-a-18`, `--white-a-28`, `--white-a-35`, `--white-a-45`, `--white-a-75`, `--white-a-85`, `--white-a-90`, `--white-a-95` — all present (verified post-R4).
- `--black-a-28`, `--black-a-40`, `--black-a-50` — verify with `grep -E "^\s*--black-a-(28|40|50):" src/shared/theme.css`.

Missing tokens to **add to theme.css** (Rule 3):

```css
/* Add to the `--black-a-*` ladder if not present */
--black-a-40: rgba(0, 0, 0, 0.40);
--black-a-50: rgba(0, 0, 0, 0.50);

/* Add to the `--shadow-*` section as semantic tokens for media overlays */
--shadow-text-on-media-light:  0 1px 4px var(--black-a-40);
--shadow-text-on-media-soft:   0 1px 3px var(--black-a-50);
--shadow-text-on-media-medium: 0 1px 4px var(--black-a-50);

/* Add scrim gradients used by Stories/TikTok/Instagram-style widgets */
--scrim-top-strong:    linear-gradient(to bottom, var(--black-a-50) 0%, transparent 100%);
--scrim-bottom-strong: linear-gradient(to top, var(--black-a-75) 0%, transparent 100%);
```

The scrim gradients are reusable across `tiktok-video`, `instagram-story`, `meta-carousel`, `interactive-video` — adding once pays back ~5 widgets later.

**Step 3 — Refactor the palette and styles.**

```ts
// AFTER

// Brand-justified colors. These reproduce TikTok's visual identity and must
// remain literal — they are not theme decisions, they are external-brand assets.
// If the brand changes them, this is the file to update.
const tiktokBrandPalette = {
  pink: '#fe2c55',
  cyan: '#25f4ee',
  shellGradient: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
} as const;

// Generic neutrals come from theme tokens. Reference via var() in style objects.
// No const needed.

const tiktokFullSizeStyle = { width: '100%', height: '100%' } as const;
const tiktokIconShellStyle = { width: '100%', height: '100%' } as const;
const tiktokMuteIconStyle: CSSProperties = {
  width: 15,
  height: 15,
  fill: 'var(--white-a-95)', // was: tiktokPalette.white
};
const tiktokVideoFillStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  zIndex: 0,
  pointerEvents: 'none',
};
const tiktokEmptyStateStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: tiktokBrandPalette.shellGradient, // BRAND
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  zIndex: 0,
};
const tiktokEmptyEmojiStyle: CSSProperties = { fontSize: 32, opacity: 0.35 };
const tiktokEmptyCopyStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--white-a-35)', // was: tiktokPalette.mutedWhite35
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  textAlign: 'center',
  lineHeight: 1.7,
};
const tiktokTopGradientStyle: CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: 140,
  background: 'var(--scrim-top-strong)', // was: tiktokPalette.topGradient
  zIndex: 1,
  pointerEvents: 'none',
};
const tiktokBottomGradientStyle: CSSProperties = {
  position: 'absolute',
  bottom: 0, left: 0, right: 0,
  height: 260,
  background: 'var(--scrim-bottom-strong)', // was: tiktokPalette.bottomGradient
  zIndex: 1,
  pointerEvents: 'none',
};
const tiktokMuteButtonStyle: CSSProperties = {
  position: 'absolute',
  top: 40, right: 14,
  width: 30, height: 30,
  borderRadius: '50%',
  background: 'var(--black-a-50)', // was: tiktokPalette.blackOverlay50
  border: '1.5px solid var(--white-a-28)', // was: tiktokPalette.mutedWhite30 → rounded to ladder
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 20,
};
// ... continue for all const styles
```

**Notable migration**: line 92 of the original — `textShadow: \`0 1px 3px ${tiktokPalette.blackOverlay40}\`` — becomes `textShadow: 'var(--shadow-text-on-media-light)'`. Cleaner, semantic, and the shadow is now reusable.

**Critical migration**: line 101 of the original — the avatar ring gradient uses brand colors:

```ts
background: `linear-gradient(135deg,${tiktokPalette.tiktokPink} 0%,${tiktokPalette.tiktokCyan} 100%)`,
```

This must stay using `tiktokBrandPalette.pink` and `tiktokBrandPalette.cyan`. CSS `var()` interpolation in template literals **does not work** the same way — you'd need `linear-gradient(135deg, var(--tiktok-pink) 0%, var(--tiktok-cyan) 100%)` and exposing brand tokens to CSS, which is wrong. Keep as JS template literal interpolation.

**Step 4 — Run tests and visually verify.**

- `npm run typecheck -w @smx/studio` — must pass.
- `npm run test -w @smx/studio` — must pass.
- Visual diff: add a TikTok widget to a canvas, screenshot before/after.
- Pay attention to: the avatar ring gradient (brand), the empty-state text color, the mute button border, the bottom-content text shadow.

**Step 5 — Document the convention.**

Add to `apps/studio/src/widgets/modules/README.md` (create if missing):

```markdown
# Widget Renderer Conventions

## Hardcoded literals

Widget renderers may contain hex/rgba literals **only** when those literals
reproduce a real-world brand identity (e.g., TikTok pink, Instagram gradient,
WhatsApp green). Brand literals live in a `*BrandPalette` const at the top
of the renderer file and are **not** migrated to theme tokens — they are not
design system decisions.

All other color/opacity/shadow values must come from `var(--*)` tokens
defined in `apps/studio/src/shared/theme.css`. If a needed token does not
exist, add it to the theme rather than hardcoding.

Geometry (width, height, transform, opacity from animation) stays inline as
CSSProperties. Only color/visual-styling literals are in scope for migration.

See `tiktok-video.renderer.tsx` for the canonical example of this split.
```

### Acceptance criteria

- The renamed `tiktokBrandPalette` const contains exactly 3 entries: `pink`, `cyan`, `shellGradient`. Nothing else.
- Running `grep -oE '#[0-9a-fA-F]{3,8}' src/widgets/modules/tiktok-video.renderer.tsx` returns **only** the brand colors (`#fe2c55`, `#25f4ee`, `#1a1a2e`, `#16213e`, `#0f3460`) — 5 literals max, all inside `tiktokBrandPalette`.
- Running `grep -oE 'rgba\(' src/widgets/modules/tiktok-video.renderer.tsx` returns **0** matches.
- Visual screenshot before vs. after is identical to the eye.
- `widgets/modules/README.md` exists with the convention.
- `npm run typecheck` and `npm run test` pass.

### Out of scope for G1

- Migrating other renderers. That's G2/G3.
- Refactoring renderer logic, hooks, or layout. Only color/shadow/gradient migration.

---

## G2 — Migrate the medium-density renderers

**Severity**: 🟠 should-do · **Effort**: L (full sprint) · **Surface**: widgets/modules

### Context

After G1 establishes the pattern, apply it mechanically to the renderers with **moderate** literal density (10–24 literals each). These are easier than `dynamic-map` because they have less geometry and more pure-color work.

### Files in scope

In order of complexity (easiest first):

1. `widgets/modules/teads-layout1.renderer.tsx` (15 literals, 18 inline styles)
2. `widgets/modules/teads-layout2.renderer.tsx` (10 literals, 14 inline styles)
3. `widgets/modules/shoppable-sidebar.renderer.tsx` (11 literals, 14 inline styles)
4. `widgets/modules/instagram-story.renderer.tsx` (11 literals, 14 inline styles)
5. `widgets/modules/vertical-accordion.renderer.tsx` (10 literals, 23 inline styles)
6. `widgets/modules/speed-test.renderer.tsx` (10 literals, 26 inline styles)
7. `widgets/modules/interactive-video.renderer.tsx` (10 literals, 17 inline styles)
8. `widgets/modules/four-faces.renderer.tsx` (9 literals, 26 inline styles)

### Procedure (apply to each file)

1. **Read the file.** Identify the `palette` const (or the inline literals if no const exists).
2. **Classify every literal.** Use Rule 1's three buckets. Brand colors stay; generics migrate; runtime stays inline.
3. **Refactor the palette.**
   - Rename `<widget>Palette` → `<widget>BrandPalette` and trim it to brand-only colors.
   - Replace generic-neutral references with `var(--*)` in the corresponding style objects.
4. **Add missing tokens to `theme.css`** if needed. Tokens to consider for these widgets:
   - `--scrim-top-soft: linear-gradient(to bottom, var(--black-a-28) 0%, transparent 100%);`
   - `--scrim-bottom-soft: linear-gradient(to top, var(--black-a-40) 0%, transparent 100%);`
   - `--surface-card-overlay: var(--black-a-50);`
   - `--text-on-media-strong: var(--white-a-95);`
   - `--text-on-media-muted: var(--white-a-75);`

   Add only what at least 3 widgets will use. Otherwise inline `var(--white-a-XX)` directly.

5. **Visual diff each one.** Add the widget to a canvas, screenshot, refactor, screenshot, compare.
6. **Commit each renderer separately.** Atomic commits make rollback easy if a visual regression slips through.

### Brand-color reference per widget

For each widget, identify which colors are brand and must stay literal:

- **teads-layout1 / teads-layout2**: Teads is a video-ad platform; their UI samples might use generic dark colors. Likely **0 brand literals** — mostly migrates fully.
- **shoppable-sidebar**: probably has product-card-style colors. Likely 1–2 brand-ish colors (a CTA "Shop" button) which may be a brand color or may be a theme accent. Verify against the design.
- **instagram-story**: Instagram has a famous gradient (`#feda77 → #f58529 → #dd2a7b → #8134af → #515bd4`). That's brand. Pink-purple-orange. **Keep as literal.**
- **vertical-accordion**: probably 0 brand. Migrate fully.
- **speed-test**: likely 0 brand (it's a generic gauge). Verify the gauge color.
- **interactive-video**: likely 0 brand (it's a generic player UI).
- **four-faces**: Bocadeli World Cup banner. Brand colors of the campaign (red/yellow/blue likely). **Keep brand colors literal.**

### Acceptance criteria

For each migrated renderer:
- Brand-colors-only `palette` const at top of file (renamed to `<widget>BrandPalette`).
- Zero `rgba(...)` literals outside the brand palette.
- Zero hex literals outside the brand palette.
- Visual screenshot before/after: identical.
- File-level diff in PR shows only color/style changes (no logic changes).

Aggregate target after G2:
- `grep -rcE '#[0-9a-fA-F]{3,8}|rgba?\(' src/widgets/modules/ --include="*.tsx" 2>/dev/null | awk -F: '{s+=$2} END {print s}'` — **down from 376 to ≤120** (about 1/3 of current). The remainder is brand-justified.

### Out of scope

- The 14 `*.shared.ts` files. Those hold default props (text strings, brand colors) that are correctly centralized. Don't touch them.
- `definitions/*.definition.ts` files. Those are widget metadata, not renderers.
- Inspectors (`*.inspector.tsx`). Those are editor UI and were already migrated.

---

## G3 — Migrate the heavyweight: `dynamic-map.renderer.tsx`

**Severity**: 🟠 should-do · **Effort**: L · **Surface**: widgets/modules

### Context

`dynamic-map.renderer.tsx` is the densest renderer in the codebase: **74 inline `style=` references and 21 hex/rgba literals across 1,230 lines**. It also has the most runtime logic (Leaflet map embedding, marker rendering, tooltip popups, action buttons). The migration is mechanically the same as G2 but takes longer because there are more spots to touch.

### Special considerations

1. **Leaflet styles**: the file imports Leaflet which has its own CSS. Leaflet CSS uses `!important` in places. Be careful that `var(--*)` substitutions don't get overridden by Leaflet's defaults. If a substitution doesn't render, check Leaflet's stylesheet. Solution: wrap the affected element in a class with explicit overrides in `shared/styles/widgets-dynamic-map.css` (if such a file makes sense — propose creating one).

2. **Marker tooltip styles**: marker popups are rendered by Leaflet inside an iframe-like context. Confirm whether `var(--*)` resolves there. If yes, migrate. If no, those literals are out of scope (treat as Rule 2 export-renderer pattern).

3. **Map controls**: Leaflet zoom buttons have their own CSS classes. Don't migrate those — they're Leaflet's, not ours.

### Procedure

Same as G2, but:

1. Split the work over 2 days instead of 1.
2. Visual-diff after every ~10 literal migrations, not just at the end. Easier to find regressions in small batches.
3. Pay extra attention to the marker icon SVGs — if any inline SVG has `fill="#XXXXXX"`, classify as G2 normally (most map markers are brand-neutral).

### Acceptance criteria

- Brand palette in `dynamic-map.renderer.tsx` has ≤ 3 entries (likely just a "Waze blue" if used, "Google Maps red" if used).
- Hex/rgba literals outside the brand palette: **0**.
- Visual diff with a sample map widget on a canvas: identical (or any drift is justified by token rounding).
- Map markers, tooltips, action buttons all render correctly.
- The Leaflet map itself still loads and pans/zooms.

### Aggregate target after G3

- `grep -rcE '#[0-9a-fA-F]{3,8}|rgba?\(' src/widgets/modules/ --include="*.tsx" 2>/dev/null | awk -F: '{s+=$2} END {print s}'` — **down from 376 to ≤80**. The remainder is brand-justified across all renderers.

---

# Phase H — Future-proofing

These are guardrails to prevent regressions. Optional but valuable.

---

## H1 — Stylelint custom rule: ban literal `rgba(255, 255, 255, …)` and `rgba(0, 0, 0, …)` outside `theme.css`

**Severity**: 🟡 polish · **Effort**: S · **Surface**: tooling

### Context

The current `.stylelintrc.cjs` enforces `scale-unlimited/declaration-strict-value` for color properties — but only on CSS files, and only for properties listed (`/color$/`, `fill`, `stroke`, etc.). It does not catch literals embedded in `style={...}` JavaScript objects in `.tsx` files.

After G1–G3, the discipline of "generic neutrals only via tokens" lives in convention. Without a lint rule, new PRs will reintroduce literals.

### Fix

Add an ESLint custom rule (or a custom lint script) that flags:

- String literals matching `/rgba\(\s*255\s*,\s*255\s*,\s*255/` outside `theme.css` and outside files matching `*BrandPalette*` patterns.
- String literals matching `/rgba\(\s*0\s*,\s*0\s*,\s*0/` with the same exceptions.
- String literals matching `/^#[0-9a-fA-F]{3,8}$/` in `.tsx` files outside renderer brand palette objects.

The simplest implementation is a custom lint script run before tests:

```js
// scripts/lint-color-literals.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN_PATTERNS = [
  /rgba\(\s*255\s*,\s*255\s*,\s*255/,
  /rgba\(\s*0\s*,\s*0\s*,\s*0/,
];
const ALLOWED_FILES = new Set([
  'apps/studio/src/shared/theme.css',
  // export renderers are out of scope (Rule 2)
  'apps/studio/src/widgets/modules/export-renderers.ts',
]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      yield* walk(full);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      yield full;
    }
  }
}

let violations = 0;
for (const file of walk('apps/studio/src')) {
  if (ALLOWED_FILES.has(file)) continue;
  const content = readFileSync(file, 'utf8');
  for (const pattern of FORBIDDEN_PATTERNS) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      // Allow lines containing 'BrandPalette' (the brand-justified literals)
      if (line.includes('BrandPalette') || line.includes('// brand:')) return;
      if (pattern.test(line)) {
        console.error(`${file}:${idx + 1}: forbidden color literal: ${line.trim()}`);
        violations += 1;
      }
    });
  }
}

if (violations > 0) {
  console.error(`\n${violations} color-literal violation(s) found. Use theme tokens or annotate as // brand: ...`);
  process.exit(1);
}
```

Wire into `package.json`:

```json
"scripts": {
  "lint:colors": "node scripts/lint-color-literals.mjs",
  "lint": "npm run lint:css && npm run lint:colors"
}
```

### Acceptance criteria

- Adding `style={{ background: 'rgba(255,255,255,0.5)' }}` to any `.tsx` file outside `theme.css` and outside a brand palette comment fails `npm run lint:colors`.
- Adding `// brand: TikTok identity` above the literal allows it.
- Adding the literal inside a const named `*BrandPalette` allows it.
- Existing post-G3 codebase passes `npm run lint:colors` cleanly.
- The rule runs in CI.

### Out of scope

- A full ESLint plugin. Custom script is enough.
- Banning specific hex values (we're not banning all hex, only `#000`, `#fff` outside brand palettes — that's a stretch goal for H2).

---

## H2 — Document the migration pattern in a renderer skeleton

**Severity**: 🟢 nice-to-have · **Effort**: XS · **Surface**: documentation

### Context

When a developer adds a new widget, the right convention should be obvious from a template, not from reading 14 existing renderers.

### Fix

Create `apps/studio/src/widgets/modules/_template.renderer.tsx.example`:

```tsx
// apps/studio/src/widgets/modules/_template.renderer.tsx.example
//
// Template for a new widget renderer. Copy this file, rename, and adapt.
//
// Conventions (see widgets/modules/README.md for full reference):
// - Brand-justified literals live in `<widget>BrandPalette` const at the top.
//   These are colors that reproduce real-world brands (TikTok pink, Instagram
//   gradient, etc.) and are NOT design system decisions.
// - All other colors must use var(--*) from theme.css.
// - Geometry (width, height, transform, opacity from animation) stays inline.
// - If you need a token that doesn't exist, add it to theme.css. Don't hardcode.

import type { CSSProperties } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';

// ─── Brand palette ────────────────────────────────────────────────────────
// Only literal colors that simulate a real-world brand. These are NOT theme
// tokens. If this widget is brand-neutral, leave this empty.
const exampleBrandPalette = {
  // Example: spotify: '#1ed760',
} as const;

// ─── Style consts ─────────────────────────────────────────────────────────
// Reuse var(--*) tokens for non-brand colors. Geometry is inline.

const exampleShellStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  background: 'var(--surface-1)',
  color: 'var(--text)',
  borderRadius: 'var(--radius-xl)',
  overflow: 'hidden',
};

const exampleHeaderStyle: CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0,
  padding: 'var(--space-4) var(--space-5)',
  background: 'var(--scrim-top-soft)',
  color: 'var(--text-on-media-strong)',
};

// ─── Renderer ─────────────────────────────────────────────────────────────

export function renderExample(node: WidgetNode, context: RenderContext) {
  // ... actual rendering
  return <div style={exampleShellStyle}>...</div>;
}
```

Add a note in `widgets/modules/README.md`:

```markdown
## Adding a new widget renderer

Copy `_template.renderer.tsx.example` to `<widget-name>.renderer.tsx`, rename
the const exports, and adapt. Follow the brand/theme split shown in the template.
```

### Acceptance criteria

- The template file exists with comments explaining the convention.
- The README mentions it as the starting point for new renderers.

---

# Sequencing

| Sprint | Phase | Effort | Outcome |
|---|---|---|---|
| **Sprint S+1** | F1 + F2 + G1 | 1 day | Theme leftovers cleaned. Convention established with `tiktok-video` migrated. |
| **Sprint S+2** | G2 | 1 sprint | 8 medium renderers migrated. Hex/rgba count drops from 376 to ~120. |
| **Sprint S+3** | G3 + H1 + H2 | 1 sprint | `dynamic-map` migrated. Lint rule and template land. Hex/rgba count drops to ~80, all brand-justified. |

Total: ~3 sprints to reach "every literal in this codebase is brand-justified or runtime-justified."

---

# Sanity checklist for CODEX before starting any item

For each item:

- [ ] Read the linked source files in their **current** form. The audit was generated after the hardcode closeout — files may have evolved by the time you execute.
- [ ] Re-verify the literal counts with grep before claiming the migration starting point.
- [ ] Run `npm run typecheck`, `npm run test`, `npm run build` before and after.
- [ ] Take screenshots of every widget you modify, before and after, on a canvas. Attach to PR.
- [ ] Commit each renderer in a separate commit. Atomic.
- [ ] In the PR description, list:
  - The literals that **moved** from local to theme tokens, with their new var name.
  - The literals that **stayed** as brand palette, with the brand they represent.
  - Any new tokens **added** to theme.css, with their first 3 usages.

---

# What this plan does NOT cover

- **Removing inline geometry.** `style={{ width: stageWidth }}` is correct runtime use.
- **Removing inline transforms.** Animation state belongs in style props.
- **Migrating `*.shared.ts` defaults** (e.g., `'yourbrand'`, `'12.4K'`). Those are correctly centralized data, not styling.
- **Refactoring widget logic, hooks, or component structure.** Only color/shadow/gradient migration.
- **Bundle exporters** (`export-renderers.ts`, anything that produces HTML strings for ad placements). See Rule 2.
- **Theme.css cleanup beyond F1/F2.** Other ladders are already in good shape.

---

# Final note for CODEX

The bar for this sprint plan is **not zero literals**. It is:

> Every literal in this codebase is either inside a `<widget>BrandPalette` const (with a comment explaining the brand), inside `theme.css` (the source of truth), or inside an export pipeline that ships outside Studio. A reader can look at any literal and immediately know which category it's in.

When you finish G3, run:

```bash
cd apps/studio
echo "Hex/rgba literals in widget renderers (excluding BrandPalette and shared.ts):"
rg --no-heading -E '#[0-9a-fA-F]{3,8}\b|rgba?\(' src/widgets/modules/ \
  --glob '*.renderer.tsx' \
  | grep -v 'BrandPalette' \
  | grep -v '// brand:' \
  | wc -l
```

If that number is `0`, the plan is complete. If it's `>0`, classify each remaining literal and either annotate it as `// brand:` (if brand-justified and missed during the migration) or migrate it to a token.

---

*End of plan.*
