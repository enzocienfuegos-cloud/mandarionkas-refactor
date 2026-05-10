# Studio UX-UI Closeout — Residuals Plan for CODEX

> **Purpose**: Close the 4 remaining items from the post-closeout audit. The roadmap is otherwise complete.
> **Scope**: `apps/studio` only.
> **Total effort**: ~1 day if all four are done. ~15 minutes if only the urgent one is done.
> **Sequencing**: R1 must ship first (it's a real perf bug). R2 is a deuda cleanup. R3 and R4 are polish — optional.

---

## Conventions

- **Severity**: 🔴 ship now / 🟠 should-do / 🟡 polish
- **Effort**: XS (≤30 min), S (≤2h), M (half-day), L (full day)
- All paths are relative to `apps/studio/src/` unless noted
- Every item must keep `npm run lint:css -w @smx/studio`, `npm run typecheck -w @smx/studio`, and `npm run test -w @smx/studio` green

---

## R1 — PreflightTray re-runs on every store change

**Severity**: 🔴 ship now · **Effort**: XS · **Surface**: shell

### Context

`apps/studio/src/app/shell/PreflightTray.tsx` line 178:

```ts
const state = useStudioStore((snapshot) => snapshot);
```

This subscribes the component to the **entire** store. Every store change — including `playheadMs` updates that fire 60 times per second during preview animation — triggers a re-render and re-runs `buildExportPreflight(state)` and `buildStudioPreflightFindings(state, preflight)`.

The existing `useMemo` calls below it have `[state]` and `[state, preflight]` as deps. Because each store update produces a new top-level `state` object reference, the memos invalidate every frame. The memo is decorative, not protective.

**Verified**: `buildExportPreflight` (in `apps/studio/src/export/preflight.ts`) only reads `state.document`. It does not read `state.ui`, `state.workspace`, or any other slice. Confirmed by grepping `state.` inside `preflight.ts`, `bundle.ts`, and `channels.ts` — every match is `state.document.*`.

This means we can safely narrow the subscription to `state.document` and the preflight will be exactly as accurate as today, but only re-runs when the document actually changes.

### Fix

Replace the top of `PreflightTray()` with a narrowed subscription. The `useStudioStore` hook in this codebase is `useSyncExternalStoreWithSelector`-based (see `apps/studio/src/core/store/use-studio-store.ts`) and accepts an optional `equalityFn` as the second argument. `Object.is` (the default) is sufficient here because we're selecting a stable object reference (`state.document`) that only changes when a reducer produces a new document.

```tsx
// apps/studio/src/app/shell/PreflightTray.tsx

export function PreflightTray(): JSX.Element {
  // BEFORE:
  // const state = useStudioStore((snapshot) => snapshot);

  // AFTER:
  const documentSnapshot = useStudioStore((snapshot) => snapshot.document);

  const sceneActions = useSceneActions();
  const widgetActions = useWidgetActions();
  const [collapsed, setCollapsed] = useState(true);

  // Wrap the document into the StudioState shape that buildExportPreflight expects.
  // Since preflight only reads state.document, we can safely build a thin synthetic state.
  const syntheticState = useMemo<StudioState>(
    () => ({ document: documentSnapshot } as StudioState),
    [documentSnapshot],
  );

  const preflight = useMemo(() => buildExportPreflight(syntheticState), [syntheticState]);
  const findings = useMemo(
    () => buildStudioPreflightFindings(syntheticState, preflight),
    [syntheticState, preflight],
  );

  // ... rest of the function uses `syntheticState` everywhere `state` was used.
```

**Important**: there is one place in the original `PreflightTray` that reads `state.document.widgets` and `state.document.selection.activeSceneId` (the `focusFindingScope` callback). Those are inside `documentSnapshot`, so they keep working. Verify by reading the function in full and substituting `state` → `syntheticState`.

### Alternative (cleaner if you want to refactor `buildStudioPreflightFindings`)

If you want to avoid the synthetic-state cast, refactor `buildStudioPreflightFindings` to accept `(documentSnapshot, preflight)` instead of `(state, preflight)`. Since the function only reads `state.document` internally (verifiable by grep), this is a mechanical change. Then the component becomes:

```ts
const documentSnapshot = useStudioStore((s) => s.document);
const preflight = useMemo(() => buildExportPreflight({ document: documentSnapshot } as StudioState), [documentSnapshot]);
const findings = useMemo(() => buildStudioPreflightFindings(documentSnapshot, preflight), [documentSnapshot, preflight]);
```

Either approach is acceptable. Pick the one that touches fewer files; the synthetic-state cast is local to `PreflightTray.tsx`.

### Acceptance criteria

1. Profile the editor in preview mode with one widget that has a live keyframe animation (any widget will do — pick an Image with an opacity keyframe). Run preview for 5 seconds.
   - **Before fix**: `buildExportPreflight` is called ~300 times (60 fps × 5 s).
   - **After fix**: `buildExportPreflight` is called ≤ the number of times the document changes. For a static preview, that should be 0.
   - Measure by adding a temporary `console.count('preflight-run')` inside `buildExportPreflight` and counting in DevTools.
2. Adding a widget while the tray is open must still update the findings within one frame.
3. Removing a widget must still update the findings within one frame.
4. Changing the export channel (`state.document.metadata.release.targetChannel`) must still update channel-specific findings.
5. `npm run test -w @smx/studio` continues to pass. If there is a test for `PreflightTray`, update its mock to provide just `{ document: {...} }` instead of a full state.

### Suggested test

Add `apps/studio/src/testing/unit/shell/preflight-tray-perf.test.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { useStudioStore } from '../../../core/store/use-studio-store';
// ... appropriate test harness

it('does not recompute preflight when only state.ui changes', () => {
  const spy = vi.spyOn(/* preflight module */, 'buildExportPreflight');
  // mount component
  // dispatch a UI-only action (e.g., setPlayhead, setZoom, setPreviewMode)
  // assert spy was called exactly once after mount, not again after the UI dispatch
});
```

---

## R2 — Close B1: migrate platform shell off the legacy button system

**Severity**: 🟠 should-do · **Effort**: M-L · **Surface**: platform, theme

### Context

The audit closeout claims B1 was implemented. In the **editor** (TopBar, Inspector, Timeline) it was — call sites use the `<Button>` and `<IconButton>` primitives. But the **platform shell** (the chrome around the editor: agency hub, client workspace) was not migrated. Two systems coexist:

1. `.btn--*` classes in `apps/studio/src/shared/styles/components.css` (the new system, used by primitives).
2. Element selectors in `apps/studio/src/shared/theme.css` lines 443–493 (`button { ... }`, `button:hover`, `button.primary`, `button.ghost`, `button:disabled`) and 38 call sites using `<button className="ghost compact-action">` or `<button className="primary compact-action">`.

The legacy element selectors **win on specificity** over `.btn--*` (specificity 0,1,1 vs 0,1,0), so any `<Button variant="primary">` rendered after a legacy `<button className="primary">` would actually take legacy styling. Today this is masked because the editor migrated cleanly and the platform stayed entirely on legacy. The first time someone adds a `<Button>` inside `AgencyShell.tsx`, the styling will be inconsistent and hard to debug.

### Affected files

```
apps/studio/src/platform/AgencyShell.tsx                    (12+ occurrences)
apps/studio/src/platform/ClientWorkspaceShell.tsx           (4+ occurrences)
apps/studio/src/shared/ui/ColorControl.tsx                  (line 89)
apps/studio/src/shared/ui/ToastProvider.tsx                 (line 87)
```

Plus theme cleanup in `apps/studio/src/shared/theme.css` lines 443–493.

### Fix

**Step 1 — Migrate call sites.**

For each `<button className="ghost compact-action" ...>`, replace with:

```tsx
<Button variant="ghost" size="sm" {...rest}>
  {children}
</Button>
```

For each `<button className="primary compact-action" ...>`:

```tsx
<Button variant="primary" size="sm" {...rest}>
  {children}
</Button>
```

The size mapping from legacy to primitive:
- `compact-action` (which had `min-height: 38px` per `utilities.css` line 164) maps to `size="sm"` (which is `--control-h-sm: 28px`) or `size="md"` (which is `--control-h-lg: 36px`). Pick `sm` for tight rows (table actions, list rows) and `md` for primary CTAs (e.g., "Resume project").
- Use visual diff to confirm size choice. The closest match to `compact-action` is `size="sm"`. If a button felt taller before, use `md`.

Edge cases to watch:
- `AgencyShell.tsx` line 64: a Logout button. Use `size="sm"`.
- `AgencyShell.tsx` line 141: "Resume project" CTA. Use `size="md"` and `variant="primary"`.
- `ColorControl.tsx` line 89: a small action inline with a swatch. Use `size="sm"`.
- `ToastProvider.tsx` line 87: a dismiss button on a toast. Likely an `IconButton` is more appropriate than `Button` — review the markup; if it has only an icon (no text), use `<IconButton variant="ghost" size="sm" label="Dismiss" icon={...}>`.

**Step 2 — Audit the focus-visible block.**

`apps/studio/src/shared/theme.css` lines 599–614 has:

```css
button:focus-visible,
input:focus-visible,
... {
  outline: none;
  box-shadow: var(--shadow-focus-keyboard);
}
```

This stays — it's correct accessibility behavior and applies equally to native buttons (in case any survive — e.g., third-party libs) and to `<Button>` (which renders `<button>` underneath).

**Step 3 — Remove legacy element selectors.**

Delete from `apps/studio/src/shared/theme.css` lines 443–493:

```css
button {
  min-height: var(--control-h-lg);
  /* ... full block ... */
}
button:hover { /* ... */ }
button:active { /* ... */ }
button.primary { /* ... */ }
button.ghost { /* ... */ }
button.ghost:hover { /* ... */ }
button:disabled { /* ... */ }
```

Keep the `button, input, select, textarea { font: inherit; }` rule at line 436 — that's a reset, not a styling decision.

**Step 4 — Verify `.btn--secondary` covers the default case.**

Today's `<Button>` defaults to `variant="secondary"`. The current `.btn--secondary` style in `components.css` is:

```css
.btn--secondary {
  background: linear-gradient(180deg, var(--surface-5), var(--gradient-panel-end));
  color: var(--text);
}
```

Compare it visually to the old default `<button>` look. If the old default had `border: 1px solid var(--stroke-a-24); box-shadow: inset 0 1px 0 var(--white-a-03), var(--shadow-3);` (theme.css line 447–448) and `.btn--secondary` doesn't, you'll see a visual regression. Add the missing properties to `.btn` or `.btn--secondary` in `components.css` so the new default matches the old default.

### Acceptance criteria

1. `rg --no-heading 'className="(ghost|primary|danger) ' apps/studio/src/` returns **zero** matches.
2. `rg -n '^button[\s.{:]' apps/studio/src/shared/theme.css` returns **zero** matches (only `button, input, select, textarea` reset survives if you keep the line 436 rule, which is acceptable).
3. Visual smoke test on agency shell: every button looks the same as before. Pay attention to Logout, Resume, pagination Previous/Next, Remove, "Open client workspace".
4. Visual smoke test on client workspace shell: back button, logout, project list buttons.
5. The `<Button variant="primary">` in `TopBarActions.tsx` (Save button) renders identically — this confirms the `.btn--primary` style is complete enough that legacy specificity is not propping it up.
6. `npm run test -w @smx/studio` passes.
7. `npm run build -w @smx/studio` produces a bundle within ±5 KB of the previous closeout (`index-*.js` was ~203 KB).

### Notes

- This is a higher-risk migration than the Phase B1 originally planned because it touches user-facing platform chrome that QA may have only checked superficially during the closeout. Do this on a feature branch and ship after a smoke pass.
- After this lands, B1 from the original CODEX plan is fully closed. Update the closeout audit notes to reflect the change.

---

## R3 — Document the C2 divergence (optional) or replace with chip strip

**Severity**: 🟡 polish · **Effort**: XS (document) or M (replace) · **Surface**: timeline

### Context

The original C2 plan called for a chip strip showing all scenes simultaneously above the `TimelineHeader`, like:

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. Intro (3.0s)  ·  2. Hero (4.5s)  ·  3. CTA (2.5s)  ·  + Scene    │
└──────────────────────────────────────────────────────────────────────┘
```

What was implemented is a `<select>` dropdown inside the `TimelineHeader` (with `[<] Scene [select] [>]` arrow nav). This solves the geographical fricion (no more reaching to the topbar) but keeps the visibility friction: with 5 scenes, you still need 2 clicks to see them all.

This is a defensible tradeoff (the timeline header is space-constrained) but it diverges from the plan.

### Two acceptable resolutions

**Option A — Document the decision (XS effort).** Recommended unless the team has explicit user feedback that scene visibility is an issue.

Add a comment block at the top of `apps/studio/src/timeline/components/TimelineHeader.tsx` explaining the choice:

```tsx
/**
 * Scene navigation lives inside the TimelineHeader as a <select> dropdown rather
 * than as a horizontal chip strip (as originally proposed in the UX-UI
 * improvement plan, item C2).
 *
 * Reasoning: the timeline header is already dense (play/pause, snap, selection
 * filter, zoom, duration, snap-target pill). Adding a chip strip would force
 * either a two-line header or aggressive horizontal scrolling on common
 * resolutions. The dropdown preserves the design intent (scene switching is
 * adjacent to the timeline, not in the topbar) while keeping the header
 * single-line.
 *
 * If user research shows that scene visibility is friction (e.g., projects with
 * 5+ scenes), revisit this decision and consider:
 *   - A persistent chip strip rendered ABOVE the timeline header (separate row)
 *   - A scene-overview popover that opens from a "Scenes" button
 */
```

Update the closeout notes (`studio-ux-ui-closeout-audit-notes-2026-05-08.md`) to mark C2 as "implemented with documented divergence" rather than "implemented".

**Option B — Replace with chip strip (M effort).** Only if the team agrees the dropdown is wrong.

Add `apps/studio/src/timeline/components/TimelineSceneStrip.tsx` per the original plan. Render it inside `BottomTimeline.tsx` between the `<TimelineHeader>` and the rest of the timeline. Remove the scene-switcher block from `TimelineHeader.tsx`. CSS lives in `shared/styles/timeline.css`.

The full code skeleton is in the original plan (`STUDIO-UX-UI-IMPROVEMENT-PLAN-2026-05-08.md` item C2). Reuse it.

### My recommendation

**Option A.** The friction reduction from "topbar → timeline" is the win that mattered. The chip-vs-dropdown distinction is a small UX preference and shouldn't be litigated unless a designer using the tool reports it. Document it and move on.

### Acceptance criteria (Option A)

- `TimelineHeader.tsx` has the documenting comment block at the top.
- `studio-ux-ui-closeout-audit-notes-2026-05-08.md` reflects the divergence under section "What was implemented in this closeout" → C2.

### Acceptance criteria (Option B)

- See item C2 in the original CODEX plan (`STUDIO-UX-UI-IMPROVEMENT-PLAN-2026-05-08.md`).

---

## R4 — Continue E3: trim the `--*-a-*` transparency ladder

**Severity**: 🟡 polish · **Effort**: S · **Surface**: theme

### Context

E3 already removed the audit's most-flagged oddballs (`--white-a-012`, `-015`, `-016`, `-018`, `-024`, `-025`, `-028`, `-035`, `-045`). Verified: those 9 specific tokens are gone.

Current state: `--white-a-*` defines 32 unique tokens. The original plan target was ≤16. There is room to consolidate further.

### Fix

**Step 1 — Audit usage frequency.**

```bash
cd apps/studio
for var in $(grep -oE -- "--white-a-[0-9]+" src/shared/theme.css | sort -u); do
  count=$(rg --no-heading -- "$var" src --count-matches 2>/dev/null | awk '{s+=$0} END {print s}')
  echo "$count $var"
done | sort -n
```

This produces something like:

```
0 --white-a-01
0 --white-a-02
1 --white-a-09
2 --white-a-11
...
22 --white-a-08
```

**Step 2 — Apply a usage threshold.**

Recommended rule: any token used `≤ 2` times is a candidate for removal. Replace those usages with the nearest token from the canonical ladder: `04, 08, 12, 18, 24, 28, 35, 45, 55, 75, 85, 90, 95`.

For each candidate token:
1. Find its usages with `rg`.
2. Pick the nearest canonical value. (E.g., `--white-a-09` → `--white-a-08`.)
3. Replace in source. Visually diff.
4. Delete the variable from `theme.css`.

**Step 3 — Repeat for `--accent-a-*` and `--focus-a-*`.**

Same procedure. The accent and focus ladders also have oddballs (`--accent-a-04`, `-14`, `-22`, `-28`, `-34`, `-35`, `-38`, `-42` — note `-34` and `-35` adjacent, only one is needed; same with `-22`/`-24`).

**Step 4 — Add a docblock to `theme.css`.**

Above the transparency section, add:

```css
/*
 * Transparency ladder.
 *
 * Standard tokens use percentage-based names: --white-a-04 = 4% opacity.
 * The canonical ladder is: 04, 08, 12, 18, 24, 28, 35, 45, 55, 75, 85, 90, 95.
 * Each color (--white-a-*, --accent-a-*, --focus-a-*, --black-a-*) should hold
 * to this ladder unless there is a documented reason to deviate.
 *
 * Target: ≤16 tokens per color. If you need an unlisted value, propose adding
 * it to the ladder and verifying it isn't redundant with existing values.
 */
```

**Step 5 — (Optional) Add a stylelint rule.**

`apps/studio/.stylelintrc.cjs` already has `scale-unlimited/declaration-strict-value` enforcing variable usage for color/border-radius/etc. Extend it (or add a new custom rule) banning literal `rgba(255, 255, 255, *)` and `rgba(0, 0, 0, *)` in any file inside `src/shared/styles/` (already enforced — verify) and **also** in `src/widgets/`, `src/canvas/`, `src/timeline/`, etc. — basically everything except `theme.css` itself. This prevents future ad-hoc additions.

### Acceptance criteria

1. Total `--white-a-*` token count is ≤ 20 (down from 32). Stretch goal: ≤ 16.
2. Total `--accent-a-*` and `--focus-a-*` are similarly trimmed.
3. Visual diff of every screen of the editor (TopBar, LeftRail, Inspector, Timeline, Stage, modals) shows no perceptible regression. Take before/after screenshots.
4. The new docblock exists at the top of the transparency section in `theme.css`.
5. `npm run lint:css -w @smx/studio` passes.
6. `npm run build -w @smx/studio` shows the same or smaller `index-*.css` bundle size.

---

## Sequencing

| When | Item | Why |
|---|---|---|
| **Today** | R1 | Real perf bug, 15-minute fix, no risk |
| **Next sprint** | R2 | Closes B1 properly. Touches platform UI — schedule with QA window |
| **Anytime** | R3 (Option A) | 10-minute documentation task, can land in any PR |
| **Anytime, low priority** | R4 | Pure polish. Defer if there's higher-value work |

---

## What this plan does NOT cover

These remain outside the scope of "closing the original UX-UI plan":

- **Widget renderer hardcodes** (the 481 inline styles concentrated in `teads-layout1.renderer.tsx`, `dynamic-map.renderer.tsx`, `buttons.renderer.tsx`, `shared-styles.tsx`, `video-hero.renderer.tsx`). This is its own RFC, separate from the UX-UI plan.
- **Export/domain widget-type branching** (the 21 residual `widget.type === ...` checks). Acceptable as scaling-hotspot debt but not part of this plan.
- **Visual regression test infrastructure** (Percy, Chromatic, or screenshots on Playwright). The closeout has good unit coverage but not visual regression coverage. If the team wants to invest, that's a standalone proposal.
- **`widget-modules` and `video-core` chunk size**. They're large by nature. Splitting them more aggressively is a separate perf RFC.

---

## Final note for CODEX

When you finish R1, verify by:

```bash
cd apps/studio
# add console.count temporarily
rg "buildExportPreflight" src/app/shell/PreflightTray.tsx
# run editor, enter preview mode, let it animate 5s, check DevTools console
```

If the count is > 5 after a 5-second animation in preview mode (assuming no document edits), the fix is incomplete and the subscription is still too broad.

---

*End of residuals plan.*
