# Studio UX-UI Improvement Plan for CODEX — 2026-05-08

> **Audience**: CODEX (the coding agent that will execute this plan against the `apps/studio` package).
> **Scope**: Improvements derived from the look-and-feel audit of Sprint 55 closeout. This plan is additive to the existing audit notes (`studio-look-and-feel-audit-notes-2026-05-08.md`) — it does not contradict them, it sequences and operationalizes the next round.
> **Style**: Each item is self-contained. Reads like a ticket. CODEX should be able to take any single item and execute it without re-reading the rest.

---

## Conventions

- **Severity**: 🔴 blocker / 🟠 high / 🟡 medium / 🟢 polish
- **Surface**: shell, timeline, inspector, stage, library, topbar, primitives, theme, contracts
- **Effort**: XS (≤30 min), S (≤2h), M (half-day), L (full day), XL (multi-day)
- All file paths are relative to `apps/studio/src/` unless noted otherwise
- All CSS changes must continue to pass `npm run lint:css -w @smx/studio`
- All TS changes must continue to pass `npm run typecheck -w @smx/studio`
- Every item ends with **Acceptance criteria** that should be turned into one or more tests when applicable

---

## Phase index

- **Phase A — Hot bugs** (must ship this sprint): A1–A7
- **Phase B — Primitives consolidation**: B1–B4
- **Phase C — UX-level redesigns**: C1–C5
- **Phase D — Strategic gaps** (rich-media production parity): D1–D3
- **Phase E — Contracts and scaling**: E1–E3

---

# Phase A — Hot bugs

These are real defects that visibly degrade the GUI today. Ship first.

---

## A1 — `timeline-row-meta` padding shorthand kills the indent variable

**Severity**: 🟠 high · **Surface**: timeline · **Effort**: XS

### Context

`TimelineTrackRow.tsx` computes a per-row indentation based on widget hierarchy depth and pushes it through a CSS custom property:

```ts
// timeline/components/TimelineTrackRow.tsx ~line 46-55
const metaIndent = 8 + depth * 16;
const rowStyle = {
  '--timeline-meta-indent': `${metaIndent}px`,
  /* ... */
} as CSSProperties;
```

The CSS rule is supposed to apply that indent through `padding-left`:

```css
/* shared/styles/timeline.css line 83 */
.timeline-row-meta {
  background: var(--white-a-02);
  padding-left: var(--timeline-meta-indent, 16px);   /* ← (1) */
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  width: 200px;
  flex-shrink: 0;
  padding: 6px 8px 6px 0;                             /* ← (2) overwrites (1) entirely */
  border-right: 1px solid var(--white-a-08);
  overflow: hidden;
}
```

The `padding: 6px 8px 6px 0` shorthand resets `padding-left` to `0`. **Result**: nested timeline rows (groups, children of groups) render at the same horizontal level as top-level rows. The hierarchy is invisible.

### Fix

Replace the shorthand with longhand declarations that preserve the variable-driven left padding:

```css
.timeline-row-meta {
  background: var(--white-a-02);
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  width: 200px;
  flex-shrink: 0;
  padding-block: 6px;
  padding-inline-end: 8px;
  padding-inline-start: var(--timeline-meta-indent, 16px);
  border-right: 1px solid var(--white-a-08);
  overflow: hidden;
}
```

### Acceptance criteria

- A widget grouped under another widget must show its meta column visibly indented (≥16px more left padding than its parent group row).
- The depth-2 row must show ≥32px more padding than the top-level row.
- No regression on the unnested rows: top-level rows must keep their current visual padding (~16px).
- Add a screenshot test or visual snapshot under `tests/timeline/` covering: `[group] / [group → child] / [group → child → grandchild]` rendering with the indent visible.

---

## A2 — Selection toolbar is not clamped to the workspace bounds

**Severity**: 🟠 high · **Surface**: stage · **Effort**: S

### Context

`canvas/stage/Stage.tsx` lines 216–227 compute the floating `StageSelectionToolbar` position:

```ts
const selectionToolbarPosition = useMemo(() => {
  const workspace = workspaceRef.current;
  const stage = stageRef.current;
  if (!workspace || !stage || !selectedWidget) return null;
  const workspaceRect = workspace.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const frame = liveFrameById[selectedWidget.id] ?? getLiveWidgetFrame(selectedWidget, playheadMs);
  return {
    x: stageRect.left - workspaceRect.left + (frame.x + frame.width / 2) * zoom,
    y: stageRect.top - workspaceRect.top + frame.y * zoom - 18,
  };
}, [/*...*/]);
```

When the selected widget has `frame.y` close to 0, the resulting `y` becomes negative and the toolbar renders above the workspace, sometimes over the topbar. The same clamp logic that protects `StageFloatingToolbar` (`clampFloatingPanelPosition` from `components/stage-utils.ts`) is not applied here.

### Fix

1. Measure the selection-toolbar bounds with a `ResizeObserver` (mirror what already happens for `toolbarRef`).
2. Pipe the raw `{x, y}` through `clampFloatingPanelPosition` using `workspaceViewport` and the measured bounds.
3. Default toolbar bounds to `{ width: 160, height: 36 }` until the observer reports.

```ts
// add at top of Stage()
const selectionToolbarRef = useRef<HTMLDivElement | null>(null);
const [selectionToolbarBounds, setSelectionToolbarBounds] = useState({ width: 160, height: 36 });

useEffect(() => {
  const el = selectionToolbarRef.current;
  if (!el) return;
  const ro = new ResizeObserver(() => {
    setSelectionToolbarBounds({
      width: Math.ceil(el.offsetWidth),
      height: Math.ceil(el.offsetHeight),
    });
  });
  ro.observe(el);
  return () => ro.disconnect();
}, [selectedWidget?.id]);

// replace the useMemo:
const selectionToolbarPosition = useMemo(() => {
  const workspace = workspaceRef.current;
  const stage = stageRef.current;
  if (!workspace || !stage || !selectedWidget) return null;
  const workspaceRect = workspace.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const frame = liveFrameById[selectedWidget.id] ?? getLiveWidgetFrame(selectedWidget, playheadMs);
  const rawX = stageRect.left - workspaceRect.left + (frame.x + frame.width / 2) * zoom - selectionToolbarBounds.width / 2;
  const rawY = stageRect.top - workspaceRect.top + frame.y * zoom - selectionToolbarBounds.height - 8;
  return clampFloatingPanelPosition(
    { x: rawX, y: rawY },
    workspaceViewport,
    selectionToolbarBounds,
  );
}, [liveFrameById, playheadMs, selectedWidget, zoom, workspaceViewport, selectionToolbarBounds]);
```

Then forward the `selectionToolbarRef` to `<StageSelectionToolbar ref={selectionToolbarRef} ... />` (add `forwardRef` to that component if not present).

### Acceptance criteria

- Selecting a widget whose `frame.y === 0` must show the selection toolbar **inside** the visible workspace (no clipping by the topbar).
- Selecting a widget at the right edge of the stage must keep the toolbar within the workspace right boundary.
- Selecting a widget while the right inspector is collapsed (workspace wider) must keep the toolbar centered over the widget.

---

## A3 — Tooltip clips inside scrollable panels and has no portal/delay

**Severity**: 🟠 high · **Surface**: primitives · **Effort**: M

### Context

`shared/ui/Tooltip.tsx` renders the bubble as `position: absolute` inside a `position: relative` shell. Whenever a tooltipped element lives inside an `overflow: auto` or `overflow: hidden` ancestor (which is the case for: `.left-rail-panel-shell`, `.right-inspector`, `.timeline-scroll`, `.inspector-accordion[open]` body), the bubble gets clipped at the container boundary.

Additional issues:
- Shows instantly on `mouseenter` (no delay → flickering when sweeping the timeline rows).
- No collision detection: tooltip can render outside the viewport.
- No keyboard escape (tooltip stays open if focus moved away via keyboard navigation in some cases).
- `mouseenter`/`mouseleave` instead of pointer events: gets stuck on touch.

### Fix

Rewrite `Tooltip` as a portal-based component with collision-aware placement and a configurable delay.

**Approach** (do not pull in a heavy lib; this is small enough to own):

1. Render the bubble through `createPortal(bubble, document.body)`.
2. On show, compute placement with `getBoundingClientRect()` of the trigger, the bubble's measured size, and the viewport. Default to `top` and flip to `bottom` if it overflows up.
3. Use a 400ms show delay (clearable on leave). Hide is immediate. The 400ms is the Material/macOS standard.
4. Use `pointerenter`/`pointerleave`. On touch (`pointerType === 'touch'`), suppress the tooltip — touch users get the `aria-label` via screen readers if any.
5. Close on `keydown` Escape.
6. Keep the existing API: `<Tooltip content={...} placement="top">`. Add `delay?: number` (default 400), `disableOnTouch?: boolean` (default true).

Suggested skeleton (do not copy verbatim; adapt to existing styles):

```tsx
// shared/ui/Tooltip.tsx
import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type TooltipProps = {
  content: ReactNode;
  children: ReactElement;
  disabled?: boolean;
  placement?: 'top' | 'bottom';
  delay?: number;
  disableOnTouch?: boolean;
};

export function Tooltip({ content, children, disabled = false, placement = 'top', delay = 400, disableOnTouch = true }: TooltipProps): JSX.Element {
  const id = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number; placement: 'top' | 'bottom' } | null>(null);
  const showTimer = useRef<number | null>(null);

  if (disabled || !content || !isValidElement(children)) return <>{children}</>;

  function scheduleShow(ev: PointerEvent | FocusEvent) {
    if (disableOnTouch && 'pointerType' in ev && (ev as PointerEvent).pointerType === 'touch') return;
    if (showTimer.current) window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => setOpen(true), delay);
  }
  function hide() {
    if (showTimer.current) { window.clearTimeout(showTimer.current); showTimer.current = null; }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !bubbleRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const b = bubbleRef.current.getBoundingClientRect();
    const margin = 8;
    let resolved: 'top' | 'bottom' = placement;
    let top = placement === 'top' ? t.top - b.height - margin : t.bottom + margin;
    if (top < 0) { resolved = 'bottom'; top = t.bottom + margin; }
    if (top + b.height > window.innerHeight) { resolved = 'top'; top = t.top - b.height - margin; }
    let left = t.left + t.width / 2 - b.width / 2;
    left = Math.max(margin, Math.min(window.innerWidth - b.width - margin, left));
    setCoords({ left, top, placement: resolved });
  }, [open, placement, content]);

  const child = cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-describedby': open ? id : undefined,
    ref: (el: HTMLElement | null) => {
      triggerRef.current = el;
      const orig = (children as { ref?: unknown }).ref;
      if (typeof orig === 'function') orig(el);
      else if (orig && typeof orig === 'object') (orig as { current: HTMLElement | null }).current = el;
    },
    onPointerEnter: scheduleShow,
    onPointerLeave: hide,
    onFocus: scheduleShow,
    onBlur: hide,
  });

  const bubble = open && coords ? createPortal(
    <span
      ref={bubbleRef}
      id={id}
      role="tooltip"
      className={`tooltip-bubble tooltip-bubble--${coords.placement} tooltip-bubble--portal`}
      style={{ position: 'fixed', left: coords.left, top: coords.top }}
    >
      {content}
    </span>,
    document.body,
  ) : null;

  return <>{child}{bubble}</>;
}
```

**CSS adjustment** in `shared/styles/components.css`: add `.tooltip-bubble--portal { transform: none; }` to override the `translateX(-50%)` legacy transform (we now compute exact left). Also remove `position: absolute` from the portal variant since fixed is set inline.

### Acceptance criteria

- A tooltip on an `IconButton` inside `.right-inspector` near the bottom of a long inspector must render fully visible (not clipped).
- A tooltip on the leftmost `timeline-layer-toggle` of a `timeline-row-meta` must render fully visible despite the `overflow: hidden` on the meta column.
- Sweeping the cursor across all 8 toolbar buttons in `TimelineHeader` does **not** flash 8 tooltips. Only the one stationary tooltip after 400ms appears.
- On a touch device (or with DevTools touch emulation), tapping a tooltipped button does **not** show a tooltip — it triggers the action.
- Pressing `Escape` while a tooltip is visible closes it without affecting focus.

---

## A4 — Inspector hero header is not sticky

**Severity**: 🟡 medium · **Surface**: inspector · **Effort**: XS

### Context

`inspector/RightInspector.tsx` renders an `<div className="inspector-hero">` block with the widget title, scene pill, selection state pill, and caption. As the user scrolls down through the accordions (e.g. into Behavior → Keyframes), the hero scrolls out of view. The user loses the anchor of "I'm editing this widget".

### Fix

In `shared/styles/inspector.css`, make the hero sticky:

```css
.inspector-hero {
  position: sticky;
  top: 0;
  z-index: var(--z-local-2);
  background: var(--gradient-modal-surface);
  /* keep existing padding/border as-is */
}
```

Verify that `.inspector-shell` does not currently clip the sticky positioning (it must use `overflow: auto` on a parent of the hero, not on the hero itself). If `.right-inspector` has `overflow: auto` (it does, per `utilities.css` line 4), the sticky works correctly.

### Acceptance criteria

- Scrolling the inspector body down by 600px keeps the hero header pinned to the top of the inspector pane.
- The hero remains visually distinct (non-transparent background) when content scrolls behind it.
- No regression on the floating handle: the resize handle on the inspector left edge must still work.

---

## A5 — Resize handlers do not throttle, do not clean up on unmount

**Severity**: 🟡 medium · **Surface**: shell · **Effort**: S

### Context

`app/shell/StudioShell.tsx` lines 39–90 attach `pointermove` and `pointerup` to `window` directly inside event handlers. Two issues:

1. **No cleanup on unmount**. If the component unmounts mid-drag (HMR, navigation), the listeners stay attached and reference stale `setLayout`. Memory leak + stale-closure update on the next mount.
2. **No frame throttle**. Each `pointermove` fires `setLayout(...)` which re-renders the entire shell (which re-renders Stage, Timeline, Inspector). At 60 Hz × 3 panels × moderate render cost, drag is jittery on lower-spec machines.

### Fix

Refactor the three resize handlers to share a helper that:

- Uses `useRef` to track the active drag instead of relying on closure capture.
- Uses `requestAnimationFrame` to coalesce updates.
- Has a `useEffect` cleanup that removes any attached listener if it survives.

Skeleton:

```ts
// app/shell/use-shell-resize.ts (new file)
import { useEffect, useRef } from 'react';

type DragHandlers = {
  onMove: (event: PointerEvent) => void;
  onUp?: (event: PointerEvent) => void;
};

export function useShellResize() {
  const activeRef = useRef<DragHandlers | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastEventRef = useRef<PointerEvent | null>(null);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      lastEventRef.current = event;
      if (rafRef.current !== null || !activeRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const handler = activeRef.current;
        const last = lastEventRef.current;
        if (handler && last) handler.onMove(last);
      });
    };
    const onUp = (event: PointerEvent) => {
      const handler = activeRef.current;
      activeRef.current = null;
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      handler?.onUp?.(event);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      activeRef.current = null;
    };
  }, []);

  return {
    begin(handlers: DragHandlers) { activeRef.current = handlers; },
  };
}
```

Then in `StudioShell.tsx`, use:

```ts
const resize = useShellResize();

const handleLeftRailResizeStart = useCallback((startX: number, edge: 'left' | 'right') => {
  const startWidth = leftRailWidth;
  resize.begin({
    onMove: (event) => {
      const delta = event.clientX - startX;
      const next = edge === 'right' ? startWidth + delta : startWidth - delta;
      setLayout((current) => ({
        ...current,
        leftRailWidth: clamp(next, LEFT_RAIL_MIN_WIDTH, LEFT_RAIL_MAX_WIDTH),
      }));
    },
  });
}, [leftRailWidth, setLayout, resize]);
```

Same pattern for inspector resize and timeline resize.

### Acceptance criteria

- Dragging the left rail resize handle for 5 seconds must not show jitter or visible frame drops on a mid-tier laptop.
- Unmounting the shell mid-drag (e.g. clicking "back to workspace hub" while dragging) must not throw a React state update warning in dev console.
- Profiling with React DevTools must show the shell's `setLayout` invocations capped at ≤60/s during a sustained drag.

---

## A6 — `editModeWireframe` write-on-mount races with read-on-mount

**Severity**: 🟢 polish · **Surface**: stage · **Effort**: XS

### Context

`canvas/stage/Stage.tsx` lines 197–208:

```ts
useEffect(() => {
  if (didRestoreWireframePreferenceRef.current) return;
  didRestoreWireframePreferenceRef.current = true;
  const persisted = readEditModeWireframePreference(editModeWireframe);
  if (persisted !== editModeWireframe) {
    uiActions.setEditModeWireframe(persisted);
  }
}, [editModeWireframe, uiActions]);

useEffect(() => {
  writeEditModeWireframePreference(editModeWireframe);
}, [editModeWireframe]);
```

On first mount, the second effect runs with the initial Redux store value (let's say `false`) and writes `false` to storage. Then the first effect reads the persisted `true` and dispatches the restore. The second effect runs again with `true` and writes `true`. The intermediate `false` write was noise.

### Fix

Gate the write on the same `didRestoreWireframePreferenceRef`:

```ts
useEffect(() => {
  if (!didRestoreWireframePreferenceRef.current) return;
  writeEditModeWireframePreference(editModeWireframe);
}, [editModeWireframe]);
```

Set `didRestoreWireframePreferenceRef.current = true` only **after** the restore effect completes (regardless of whether it changed the state).

### Acceptance criteria

- Mounting the Stage with persisted `wireframe = true` must not produce an intermediate `false` write to storage. Verify by spying on `writeEditModeWireframePreference` and asserting it is called at most once per actual user toggle.

---

## A7 — Hardcoded `top: 132px` on collapsed-panel tabs

**Severity**: 🟢 polish · **Surface**: shell · **Effort**: XS

### Context

`shared/styles/shell.css` lines 60, 70:

```css
.collapsed-panel-tab-left  { top: 132px; left: 0; /* ... */ }
.collapsed-panel-tab-right { top: 132px; right: 0; /* ... */ }
```

The `132px` is `64px (topbar) + 68px (visual offset to center the tab)`. If `--shell-top-h` ever changes (responsive, accessibility scaling, future redesign), the tabs misalign.

### Fix

```css
.collapsed-panel-tab-left,
.collapsed-panel-tab-right {
  top: calc(var(--shell-top-h) + var(--space-12) * 2 + var(--space-5));
  /* or simply: top: calc(var(--shell-top-h) + 68px); — pick one and document */
}
```

### Acceptance criteria

- Changing `--shell-top-h` to `72px` in DevTools must shift the collapsed tabs down by exactly 8px.
- The collapsed tabs must remain vertically aligned with their original visual position when `--shell-top-h` is left at default `64px`.

---

# Phase B — Primitives consolidation

These are not bugs but they accumulate technical debt that will make future changes painful.

---

## B1 — Resolve the dual button system: theme.css element selectors vs `<Button>` primitive

**Severity**: 🟠 high · **Surface**: primitives, theme · **Effort**: M

### Context

Today `apps/studio` has **two** button styling systems coexisting:

1. **Element selectors** in `shared/theme.css` lines 445–495: `button { ... }`, `button:hover`, `button.primary`, `button.ghost`, `button:disabled`. These apply to **every** native `<button>` element in the app.
2. **Class-based primitive** in `shared/ui/Button.tsx`: emits `<button class="btn btn--{variant} btn--{size}">`. The corresponding `.btn--*` styles do not exist in any inspected CSS file (verified by grepping `shared/styles/`). The primitive currently inherits all visuals from system 1.

This is the worst of both worlds:
- The primitive offers an API (`variant`, `size`, `iconBefore`, `loading`) that has no actual CSS implementation differentiating the variants — visuals come from the legacy element selectors and `compact-action`/`primary`/`ghost` className strings passed by callers.
- Many call sites (`TopBarActions.tsx` lines 137, 152, 156, 165) bypass the primitive entirely with `<button className="ghost compact-action">`.
- A future change to button visuals requires touching both systems; missing one creates inconsistency.

### Fix

Pick **one system** and migrate. Recommended: keep the primitive, replace the element selectors.

**Migration plan**:

1. **Define `.btn` styles** in a new file `shared/styles/buttons.css` (imported from `index.css` after `theme.css`):

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  border-radius: var(--radius-xl);
  border: 1px solid var(--stroke-a-24);
  background: linear-gradient(180deg, var(--panel-3), var(--panel));
  color: var(--text);
  cursor: pointer;
  font: inherit;
  transition:
    border-color var(--motion-base) var(--motion-ease),
    background var(--motion-base) var(--motion-ease),
    transform var(--motion-base) var(--motion-ease),
    box-shadow var(--motion-base) var(--motion-ease),
    color var(--motion-base) var(--motion-ease),
    opacity var(--motion-base) var(--motion-ease);
  box-shadow: inset 0 1px 0 var(--white-a-03), var(--shadow-3);
}

.btn--sm  { min-height: var(--control-h-sm); padding: 0 var(--space-5); font-size: var(--font-size-sm); }
.btn--md  { min-height: var(--control-h-md); padding: 0 var(--space-6); font-size: var(--font-size-md); }
.btn--lg  { min-height: var(--control-h-lg); padding: 0 var(--space-7); font-size: var(--font-size-lg); }

.btn--primary   { background: var(--accent-2); color: var(--ink-strong); border-color: var(--accent-2-a-24); font-weight: 700; box-shadow: 0 10px 24px var(--accent-2-a-18); }
.btn--secondary { /* default styles already in .btn */ }
.btn--ghost     { background: var(--white-a-03); box-shadow: none; }
.btn--danger    { background: var(--danger); color: var(--ink-strong); border-color: var(--danger-a-42); }

.btn:hover  { border-color: var(--accent-a-45); background: linear-gradient(180deg, var(--panel-3), var(--panel-2)); transform: translateY(-1px); }
.btn--ghost:hover { background: var(--white-a-06); }
.btn:active { transform: translateY(0); }
.btn:disabled, .btn.is-loading { opacity: 0.5; cursor: not-allowed; transform: none; }

.btn__icon  { display: inline-flex; flex-shrink: 0; }
.btn__label { display: inline-flex; min-width: 0; white-space: nowrap; }

.btn.is-active { border-color: var(--accent-a-45); background: linear-gradient(180deg, var(--bg-selected-soft), transparent); color: var(--text-accent-bright); }
```

2. **Remove** the element selectors in `shared/theme.css` lines 445–495 (the `button { ... }`, `button:hover`, `button.primary`, `button.ghost`, `button:disabled` blocks). Keep `button:focus-visible` from line 602 (it's needed by accessibility).

3. **Migrate call sites** that use `<button className="ghost compact-action">` to `<Button variant="ghost" size="sm">`. Files known to need migration:
   - `app/shell/topbar/TopBarActions.tsx` (5 buttons)
   - `app/shell/topbar/TopBarCenterContent.tsx` (3 nav buttons inside the scene switcher)
   - `app/shell/StudioShell.tsx` (3 collapsed-panel-tab buttons — these are special, keep them but rename their class to not collide with `.btn`)
   - Any timeline order/lock/visibility buttons that today use bare `<button>` (already inconsistent with primitives)

4. **Search for stragglers**: run `rg -n "<button " src/` and audit each result. The expected end state is: every `<button>` in the app is either a `Button`/`IconButton` primitive, or a documented exception (e.g. inline timeline trim handles, which are functional grab affordances, not buttons in the visual sense).

5. **Run lint:css** to confirm no orphan selectors remain.

### Acceptance criteria

- `rg -n "^button[\s{:]" src/` returns zero matches in `shared/theme.css` (only the focus-visible block survives, and even that should ideally migrate to `.btn:focus-visible`).
- All Preview/Export/Share/Publish buttons in the topbar render via `<Button>` primitive.
- Visual regression tests (or manual visual diff) confirm: primary buttons look identical, ghost buttons look identical, hover states preserved.
- `npm run test -w @smx/studio` passes.

---

## B2 — Document when to use `Tabs` vs `SegmentedControl`

**Severity**: 🟢 polish · **Surface**: primitives · **Effort**: XS

### Context

Two segmented-selection primitives coexist with overlapping use cases:

- `shared/ui/Tabs.tsx` (75 LOC) — used in inspector for Basics/Behavior/Data
- `shared/ui/SegmentedControl.tsx` (34 LOC) — used in WidgetLibrary for category filter

A new developer adding a third use case will not know which to pick.

### Fix

Add a doc comment at the top of each primitive specifying:

```tsx
// shared/ui/Tabs.tsx
/**
 * Tabs — for switching between *different content panels* in the same surface.
 * Renders with role="tablist" / role="tab". Use when each option reveals a
 * distinct, fairly large region of UI (forms, panels, sections).
 *
 * Example: Inspector tabs (Basics / Behavior / Data).
 *
 * For a small filter that returns a subset of an existing list (without
 * changing the surrounding panel structure), prefer SegmentedControl.
 */
```

```tsx
// shared/ui/SegmentedControl.tsx
/**
 * SegmentedControl — for picking one option from a small set that filters or
 * narrows existing content in place. Renders with role="radiogroup" /
 * role="radio". Use when the choice does NOT reveal a different surface, but
 * just changes what's displayed in the current one.
 *
 * Example: Widget category filter (All / Content / Media / Interactive).
 *
 * For switching between distinct panels of UI, prefer Tabs.
 */
```

Optionally: add a one-pager `apps/studio/src/shared/ui/README.md` listing each primitive with its mandate.

### Acceptance criteria

- Both primitive files have the explanatory doc comment.
- `apps/studio/src/shared/ui/README.md` exists with a table of primitives, their semantic intent, and one example from the codebase.

---

## B3 — Tooltip API consolidation: prevent stylistic drift

**Severity**: 🟢 polish · **Surface**: primitives · **Effort**: XS (after A3 lands)

### Context

After A3 lands, the Tooltip is portal-based with delay. The remaining risk is that future code keeps using `title="..."` HTML attribute as an ad-hoc tooltip, producing inconsistent native tooltips alongside the styled ones.

### Fix

1. Add an ESLint rule (or a custom `stylelint` check, since the repo uses stylelint) banning `title` attribute on JSX elements except for `<iframe>`, `<svg>`, `<a>`, `<abbr>`. Use `eslint-plugin-jsx-a11y` if not already configured, with the custom rule:

```js
// in .eslintrc
{
  "rules": {
    "no-restricted-syntax": [
      "warn",
      {
        "selector": "JSXAttribute[name.name='title'][parent.parent.openingElement.name.name!=/^(iframe|svg|a|abbr|details)$/]",
        "message": "Use <Tooltip> instead of HTML title attribute. The title attribute is inaccessible on touch and cannot be styled."
      }
    ]
  }
}
```

2. Audit existing `title=` usages and convert to `<Tooltip>` where appropriate. Verified hot spots: `timeline/components/TimelineHeader.tsx` lines 121, 135 use `title=` on `<Button>` — convert these to `<Tooltip>` wrappers (current `title` prop is forwarded as native attribute, which is fine but inconsistent with the rest of the app).

### Acceptance criteria

- ESLint or stylelint emits a warning when a developer adds `title=` to an interactive element.
- All preexisting `title=` usages on interactive elements have been replaced with `<Tooltip>` or removed.

---

## B4 — Persist inspector accordion state per widget type

**Severity**: 🟡 medium · **Surface**: inspector · **Effort**: S

### Context

`inspector/panels/WidgetInspectorPanel.tsx` line 89:

```ts
const shouldOpen = meta.defaultOpen ?? (activeTab.id === 'basics' && index === 0);
```

Every time the user selects a new widget, the accordion state resets to this heuristic. If the user habitually opens "Keyframes" while editing image widgets, that preference is lost on every selection.

### Fix

Add a per-widget-type, per-panel-key persistence layer. Storage key shape:

```
smx.studio.inspector.accordion.v1 = {
  "image":  { "position-size": true,  "timing": false, "keyframes": true },
  "text":   { "text-content": true,   "fill": false },
  ...
}
```

Implementation:

1. Create `inspector/inspector-preferences.ts`:

```ts
import { readScopedStorageItem, writeScopedStorageItem } from '../shared/browser/storage';
import type { WidgetInspectorPanelKey } from '../widgets/registry/widget-definition';

const STORAGE_KEY = 'smx.studio.inspector.accordion.v1';

type AccordionPrefs = Record<string, Partial<Record<WidgetInspectorPanelKey, boolean>>>;

function readPrefs(): AccordionPrefs {
  try {
    const raw = readScopedStorageItem(STORAGE_KEY, '');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function writePrefs(prefs: AccordionPrefs): void {
  writeScopedStorageItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function getAccordionOpenState(widgetType: string, panelKey: WidgetInspectorPanelKey, fallback: boolean): boolean {
  const prefs = readPrefs();
  return prefs[widgetType]?.[panelKey] ?? fallback;
}

export function setAccordionOpenState(widgetType: string, panelKey: WidgetInspectorPanelKey, open: boolean): void {
  const prefs = readPrefs();
  const next: AccordionPrefs = { ...prefs, [widgetType]: { ...prefs[widgetType], [panelKey]: open } };
  writePrefs(next);
}
```

2. In `WidgetInspectorPanel.tsx`, replace the `WidgetInspectorAccordion` usage to read/write through this helper:

```tsx
function WidgetInspectorAccordion({ widgetType, panelKey, fallbackOpen, title, subtitle, children }: {
  widgetType: string;
  panelKey: WidgetInspectorPanelKey;
  fallbackOpen: boolean;
  title: string;
  subtitle: string;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(() => getAccordionOpenState(widgetType, panelKey, fallbackOpen));

  return (
    <details
      className="inspector-accordion"
      open={open}
      onToggle={(event) => {
        const next = (event.currentTarget as HTMLDetailsElement).open;
        setOpen(next);
        setAccordionOpenState(widgetType, panelKey, next);
      }}
    >
      {/* ... */}
    </details>
  );
}
```

And in the parent rendering:

```tsx
<WidgetInspectorAccordion
  key={panelKey}
  widgetType={widget.type}
  panelKey={panelKey}
  fallbackOpen={meta.defaultOpen ?? (activeTab.id === 'basics' && index === 0)}
  title={meta.title}
  subtitle={meta.subtitle}
>
  {panel}
</WidgetInspectorAccordion>
```

### Acceptance criteria

- Open the "Keyframes" panel on an Image widget. Select another Image widget. "Keyframes" must remain open.
- Open "Keyframes" on Image, then select a Text widget — "Keyframes" preference for Image does not affect Text. Text uses its own preference (or the fallback if none).
- Reload the page. Preferences must persist.
- Uninstall the storage entry (manual DevTools delete) — the inspector falls back to the heuristic without crashing.

---

# Phase C — UX-level redesigns

These improve learnability, discoverability, and speed of work for the rich-media designer.

---

## C1 — Reorganize TopBar into 3 clusters with clear hierarchy

**Severity**: 🟠 high · **Surface**: topbar · **Effort**: M

### Context

The current TopBar has 12+ controls competing in a 64px-tall strip:

```
[← back] [project] [scene-prev|<select>|scene-next] [pill canvas] [breadcrumb] [Library]   [Preview] [Export ▾] [Share] [Publish] [Save] [chip]
```

Issues:
- Scene switcher is metadata about the *document content*, not about the project chrome → it belongs near the timeline, not in the topbar.
- Library button is duplicated (it already lives in LeftRail Assets tab and the Library opens via modal). Pick one origin.
- Preview / Export / Share / Publish all render with `compact-action` ghost styling — visually identical, semantically very different.
- StatusChip after the Save button competes with Save's own status feedback.

### Fix

Reorganize the topbar into the following three clusters, in this exact order:

```
LEFT CLUSTER  (workspace identity)
[← Hub]  [Project Name editable]  [• status chip in subtitle line]

CENTER CLUSTER (preview state)
[Preview ▾]  [Device picker: 320×480 ▾]  [zoom 100% ▾]

RIGHT CLUSTER (output)
[Save (cmd+S)]  [Export ▾  (combined export + share + publish menu)]
```

Specific changes:

1. **Remove from topbar**:
   - Scene switcher → move to the timeline header (see C2).
   - Library button → remove from topbar. Library is reachable from LeftRail Assets tab (with explicit "Open Library Modal" option in that tab).
   - Breadcrumb pill → demote into a tooltip on the project name (or a subtitle line under the project name).

2. **Combine Export / Share / Publish** into a single `<ExportMenu>` dropdown with three groups:
   ```
   ┌─ EXPORT ─────────────────────────────┐
   │ Export ZIP (current channel) ⌘E      │
   │ Export as ▸ Adform DHTML             │
   │            CM360                     │
   │            ClickTag                  │
   │            Raw HTML                  │
   ├─ SHARE ──────────────────────────────┤
   │ Build share package                  │
   │ Copy preview link                    │
   ├─ PUBLISH ────────────────────────────┤
   │ Publish to ad server                 │
   └──────────────────────────────────────┘
   ```

3. **Save button** stays prominent (primary variant) on the right edge. Status chip becomes part of Save's own visual state (saved / saving / saved 2s ago) instead of a separate chip.

4. **Add a Preview-mode toggle** that shows a small indicator strip across the topbar when active (helps user remember they're in preview, not edit).

5. **Add device picker**: dropdown of canvas presets (`CANVAS_PRESETS`) with the active preset visible. Selecting changes `canvasPresetId`. Also exposes "Custom" with an inline width/height editor.

6. **Add zoom dropdown**: 25% / 50% / 75% / 100% / 125% / 150% / 200% / Fit. Wires to the same `uiActions.setZoom` already used by `StageFloatingToolbar` — so the floating toolbar zoom and the topbar zoom stay synced.

**Files to touch**:
- `app/shell/TopBar.tsx` — rewrite layout
- `app/shell/topbar/TopBarCenterContent.tsx` — rewrite (remove scene switcher, add device + zoom picker)
- `app/shell/topbar/TopBarActions.tsx` — combine into single ExportMenu, simplify
- `app/shell/topbar/ExportMenu.tsx` — extend to host the combined menu
- `shared/styles/topbar.css` — adjust grid

### Acceptance criteria

- The topbar has exactly 3 visual clusters separated by clear gaps. Verified by visual inspection: a horizontal line drawn through the topbar must touch ≤ 4 elements per cluster.
- Removing the Library button from the topbar does not break any existing test. Library is still reachable from LeftRail Assets tab.
- Pressing ⌘E (Cmd+E / Ctrl+E) triggers the same default export as the topbar Export button.
- Changing zoom from the topbar updates the StageFloatingToolbar zoom value, and vice versa.
- Changing the device preset in the topbar dropdown updates the canvas dimensions on stage.
- The single ExportMenu dropdown contains all options previously split across Export, Share, and Publish.

---

## C2 — Move scene switcher next to the timeline

**Severity**: 🟠 high · **Surface**: timeline · **Effort**: S

### Context

(Continues from C1.) Scene switching is a content-level operation. Designers reach for it while animating, which means while their cursor is at the timeline. Today they must move 600+ pixels up to the topbar.

### Fix

Add a scene switcher row at the top of the timeline, just above `TimelineHeader`. The switcher shows scene chips (one per scene), with the active one highlighted, plus `+ Add scene` at the end.

```tsx
// timeline/components/TimelineSceneStrip.tsx (new file)
export function TimelineSceneStrip({
  scenes,
  activeSceneId,
  onSelectScene,
  onAddScene,
  onRenameScene,
  onDeleteScene,
}: { /* ... */ }): JSX.Element {
  return (
    <div className="timeline-scene-strip" role="tablist" aria-label="Scenes">
      {scenes.map((scene, idx) => (
        <button
          key={scene.id}
          role="tab"
          aria-selected={scene.id === activeSceneId}
          className={`timeline-scene-chip ${scene.id === activeSceneId ? 'is-active' : ''}`}
          onClick={() => onSelectScene(scene.id)}
          onDoubleClick={() => /* trigger inline rename */}
        >
          <span className="timeline-scene-chip__index">{idx + 1}</span>
          <span className="timeline-scene-chip__label">{scene.name}</span>
          <span className="timeline-scene-chip__duration">{(scene.durationMs / 1000).toFixed(1)}s</span>
        </button>
      ))}
      <button className="timeline-scene-chip timeline-scene-chip--add" onClick={onAddScene}>+ Scene</button>
    </div>
  );
}
```

Integrate in `BottomTimeline.tsx` above `<TimelineHeader>`. Wire to `useSceneActions()` already imported.

CSS in `shared/styles/timeline.css`:

```css
.timeline-scene-strip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-shell-sticky);
  overflow-x: auto;
  scrollbar-width: thin;
}
.timeline-scene-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  min-height: var(--control-h-md);
  border-radius: var(--radius-pill);
  background: var(--white-a-04);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted-base);
  white-space: nowrap;
  font-size: var(--font-size-sm);
}
.timeline-scene-chip:hover     { background: var(--white-a-06); color: var(--text); }
.timeline-scene-chip.is-active { background: var(--bg-selected-soft); border-color: var(--border-accent-strong); color: var(--text); }
.timeline-scene-chip__index    { font-weight: 700; opacity: 0.62; }
.timeline-scene-chip__duration { opacity: 0.55; font-size: var(--font-size-xs); }
.timeline-scene-chip--add      { border-style: dashed; opacity: 0.7; }
.timeline-scene-chip--add:hover { opacity: 1; }
```

### Acceptance criteria

- The scene strip renders above the timeline header with one chip per scene.
- Clicking a chip changes the active scene (verified by checking that `BottomTimeline` rerenders with the new scene's widgets and duration).
- The active chip is visually distinct (border + background).
- "+ Scene" creates a new empty scene and selects it.
- Double-clicking a chip allows inline renaming (Enter to commit, Esc to cancel).
- The scene switcher in the topbar (if not yet removed) is hidden — only one origin point survives.

---

## C3 — WidgetLibrary cards: animated previews + meaningful metadata

**Severity**: 🟠 high · **Surface**: library · **Effort**: M

### Context

`WidgetLibrarySection.tsx` renders cards with: SVG thumbnail (static), label, type slug, category pill, "Click to add or drag" hint.

Problems:
- **Static thumbs lie about behavior**: a "Meta Carousel" thumb looks like 3 horizontal squares, but the widget is a swipeable carousel with autoplay and dots. A "Speed Test" thumb is a circle, but the widget is an interactive gauge. Users can't tell what they're getting until they drop it.
- **The `widget.type` slug** (`tiktok-video`, `four-faces`) is internal noise. Designers don't need it.
- **Missing rich-media metadata**: recommended size, MRAID compatibility, asset requirements, runtime weight estimate. All of this is already in `WidgetCapabilities`, just not surfaced.

### Fix

**Phase 1 — Metadata surface (S effort)**:

1. Extend `WidgetDefinition` (in `widgets/registry/widget-definition.ts`):

```ts
export type WidgetDefinition = {
  /* ... existing ... */

  /** One-line description of what this widget does and when to use it. */
  description?: string;

  /** Recommended canvas size where this widget shines. Used in library card and as a default. */
  recommendedSize?: { width: number; height: number; label?: string };

  /** Approximate runtime cost added when included in an export (KB). Surfaces in preflight. */
  estimatedRuntimeKb?: number;

  /** Whether this widget needs at least one external asset before it can render meaningfully. */
  requiresAsset?: boolean;
};
```

2. In each existing widget definition file (`widgets/*/*.definition.ts`), populate the new fields. CODEX should **not** invent values — they should be filled by the team. CODEX should only extend the type and provide one example so the convention is clear.

**Phase 2 — Animated preview (M effort)**:

1. Extend the contract:

```ts
export type WidgetDefinition = {
  /* ... */
  /**
   * Optional animated preview component for the library card. Renders inside a
   * 160×100 fixed frame. Should auto-loop a representative state in ≤2 seconds.
   * If absent, falls back to the static `thumbnail`.
   */
  renderLibraryPreview?: () => JSX.Element;
};
```

2. In `WidgetLibrarySection.tsx`, replace the card's thumbnail rendering:

```tsx
function renderWidgetThumbnail(widget) {
  if (widget.renderLibraryPreview) {
    const Preview = widget.renderLibraryPreview;
    return (
      <div className="widget-library-card__preview">
        <Preview />
      </div>
    );
  }
  if (typeof widget.thumbnail === 'string') {
    return <img src={widget.thumbnail} alt="" className="widget-library-card__thumb-image" loading="lazy" />;
  }
  if (widget.thumbnail) {
    const Thumbnail = widget.thumbnail;
    return <Thumbnail />;
  }
  return <PlaceholderThumb category={widget.category} />;
}
```

3. Performance constraint: previews must animate **only on hover/focus** of the card to avoid burning CPU on a 30-card grid. Pattern:

```tsx
function WidgetLibraryCard({ widget }: { widget: WidgetDefinition }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      className={`widget-library-card ${isHovered ? 'is-hovered' : ''}`}
    >
      <div className="widget-library-card__thumb">
        {isHovered && widget.renderLibraryPreview ? <widget.renderLibraryPreview /> : renderStaticThumb(widget)}
      </div>
      {/* ... */}
    </div>
  );
}
```

**Phase 3 — Card layout**:

```
┌──────────────────────────────────────┐
│  [animated preview 160×100]          │
│                                      │
│  Meta Carousel                       │
│  3 slides · swipe · autoplay         │  ← description (1 line)
│                                      │
│  📐 1080×1080  ·  ⚡ 12 KB  ·  ✓ MRAID │  ← metadata strip
│                                      │
│  [Interactive] [Media]                │  ← capability pills
└──────────────────────────────────────┘
```

The metadata strip uses three short pills:
- 📐 recommended size
- ⚡ runtime cost
- ✓ MRAID (or ⚠ MRAID warning, or ✗ MRAID blocked) — sourced from `mraidCompatibility`

The capability pills replace today's category pill with a multi-pill row showing the relevant `capabilities` (e.g. `isInteractive`, `isMedia`, `isContainer`).

### Acceptance criteria

- Hovering or focusing a widget card with a `renderLibraryPreview` plays the animated preview.
- Removing focus/hover stops the animation (the card unmounts the preview to free resources).
- A widget without `renderLibraryPreview` falls back to the static thumbnail without errors.
- The card displays the recommended size, MRAID state, and at least one capability pill when those fields exist.
- The `widget.type` slug is removed from the visible card (still accessible via tooltip on the label or via dev tools).
- Performance: rendering the library with 30 widgets and hovering each in sequence does not exceed 60ms per hover transition (measured in a dev profile build).

---

## C4 — Always-on preflight tray

**Severity**: 🟠 high · **Surface**: shell, export · **Effort**: M

### Context

The export pipeline already has validation logic (`triggerExportZipBundleResolved`, `resolvedZipStatus`). Validations only surface at export time. By then, fixing them means re-editing.

In Celtra and Connected Stories, a persistent "preflight" surface shows live warnings: bundle size approaching limit, missing click-tag, animation too long, asset compression high, etc.

### Fix

1. **Create a preflight runner** in `export/preflight/index.ts` (if not already). The runner takes the current `StudioState` and returns a list of `PreflightFinding`s:

```ts
export type PreflightFindingSeverity = 'info' | 'warning' | 'error';

export type PreflightFinding = {
  id: string;                      // stable, e.g. 'bundle-size-warning'
  severity: PreflightFindingSeverity;
  title: string;                   // short, ≤ 60 chars
  detail: string;                  // explanation, ≤ 200 chars
  resolution?: string;             // suggested fix
  scope?: { widgetIds?: string[]; sceneIds?: string[] }; // for highlighting
};

export type PreflightCheck = (state: StudioState) => PreflightFinding[];
export const PREFLIGHT_CHECKS: PreflightCheck[] = [
  checkBundleSize,
  checkAssetCompression,
  checkClickTag,
  checkSceneDuration,
  checkMraidCompatibility,
  checkVideoAnalytics,
  checkMissingAlt,
  /* ... */
];
```

2. **Add a Preflight tray component** that renders persistently in the bottom-right corner (above the toast viewport, below the floating toolbar):

```tsx
// app/shell/PreflightTray.tsx (new file)
export function PreflightTray(): JSX.Element {
  const findings = useStudioStore((state) => runPreflight(state));
  const [collapsed, setCollapsed] = useState(true);

  if (!findings.length) return null;

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;

  return (
    <aside className={`preflight-tray ${collapsed ? 'is-collapsed' : 'is-expanded'}`}>
      <button
        type="button"
        className="preflight-tray__toggle"
        onClick={() => setCollapsed((c) => !c)}
      >
        {errorCount > 0 ? <span className="preflight-badge preflight-badge--error">{errorCount}</span> : null}
        {warningCount > 0 ? <span className="preflight-badge preflight-badge--warning">{warningCount}</span> : null}
        <span>Preflight</span>
      </button>
      {!collapsed ? (
        <ul className="preflight-tray__list">
          {findings.map((f) => (
            <li key={f.id} className={`preflight-finding preflight-finding--${f.severity}`}>
              <strong>{f.title}</strong>
              <small>{f.detail}</small>
              {f.resolution ? <em>{f.resolution}</em> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
```

3. **Optimize**: `runPreflight(state)` will run on every store change. Wrap with `useMemo` keyed on the document version (or a hash). Or compute per-widget findings lazily and memoize per widget — depends on scale.

4. **Mount** `<PreflightTray />` in `StudioShell.tsx` after the workspace, before the collapsed-panel tabs.

### Acceptance criteria

- Adding a video asset that pushes total bundle size above 200 KB shows an error finding in the tray.
- Removing that asset clears the finding without manual refresh.
- The tray defaults to collapsed showing a badge with severity counts.
- Expanding the tray shows all findings grouped by severity.
- Each finding's `scope.widgetIds`, when clicked, selects the relevant widgets on the stage.
- Preflight does not block exports — it informs them. Exports still trigger from the topbar regardless of findings.

---

## C5 — Keyboard shortcuts: cheat sheet + missing essentials

**Severity**: 🟠 high · **Surface**: shell · **Effort**: M

### Context

Today only 4 keyboard shortcuts exist (`Cmd+C`, `Cmd+V`, `W`, `Delete`/`Backspace`). Critical absences:

- **`Cmd+Z` / `Cmd+Shift+Z`** — undo/redo. The store already has `undo`/`redo` actions (`hooks/use-studio-actions.ts` lines 108–109), they're just not bound to keys.
- **`Cmd+S`** — save. Already wired in TopBarActions but no keybinding.
- **`Cmd+D`** — duplicate selection.
- **`Cmd+G`** / **`Cmd+Shift+G`** — group / ungroup.
- **Space (held)** — pan-mode. Already a `panModeActive` state in stage controller; needs key binding.
- **`Cmd+0`** — fit to viewport.
- **`Cmd+=` / `Cmd+-`** — zoom in/out.
- **Arrow keys** — nudge selected widget by 1px. **Shift+Arrow** by 10px.
- **`Tab`** — cycle selection forward (visible widgets in z-order). **Shift+Tab** backward.
- **`[` / `]`** — send backward / bring forward.
- **`Cmd+E`** — export with current channel (default).
- **`?`** — open keyboard shortcut cheat sheet.

### Fix

1. **Centralize bindings** in a new `app/shell/use-keyboard-shortcuts.ts`:

```ts
type ShortcutSpec = {
  combo: string;                  // 'cmd+z', 'shift+arrowleft', '?'
  description: string;
  category: 'edit' | 'navigation' | 'view' | 'file' | 'help';
  enabled?: () => boolean;        // optional dynamic guard
  action: (event: KeyboardEvent) => void;
};

export function useKeyboardShortcuts(specs: ShortcutSpec[]): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // ignore when typing in inputs (same guard used today in Stage)
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const editable = Boolean(target?.isContentEditable) || tag === 'input' || tag === 'textarea' || tag === 'select';
      if (editable) return;
      const match = specs.find((s) => matches(event, s.combo) && (s.enabled?.() ?? true));
      if (!match) return;
      event.preventDefault();
      match.action(event);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [specs]);
}
```

(`matches` is a small helper that parses `'cmd+z'` against the event — handle `cmd` as `metaKey || ctrlKey` for cross-platform.)

2. **Define the shortcut catalog** as a single source of truth (so the cheat sheet can read it):

```ts
// app/shell/shortcut-catalog.ts
export const SHORTCUT_CATALOG: ShortcutSpec[] = [
  { combo: 'cmd+z',         description: 'Undo',                category: 'edit',       action: () => useStudioStore.dispatch({ type: 'UNDO' }) },
  { combo: 'cmd+shift+z',   description: 'Redo',                category: 'edit',       action: () => useStudioStore.dispatch({ type: 'REDO' }) },
  { combo: 'cmd+s',         description: 'Save',                category: 'file',       action: () => /* dispatch save */ },
  { combo: 'cmd+d',         description: 'Duplicate selection', category: 'edit',       action: () => /* widgetActions.duplicateSelected() */ },
  { combo: 'cmd+g',         description: 'Group selection',     category: 'edit',       action: () => /* group action */ },
  { combo: 'cmd+shift+g',   description: 'Ungroup selection',   category: 'edit',       action: () => /* ungroup action */ },
  { combo: 'cmd+0',         description: 'Fit to viewport',     category: 'view',       action: () => /* fitToViewport */ },
  { combo: 'cmd+=',         description: 'Zoom in',             category: 'view',       action: () => /* zoom in */ },
  { combo: 'cmd+-',         description: 'Zoom out',            category: 'view',       action: () => /* zoom out */ },
  { combo: 'cmd+e',         description: 'Export',              category: 'file',       action: () => /* trigger export */ },
  { combo: 'arrowup',       description: 'Nudge up 1px',        category: 'edit',       action: () => /* nudge */ },
  { combo: 'arrowdown',     description: 'Nudge down 1px',      category: 'edit',       action: () => /* nudge */ },
  { combo: 'arrowleft',     description: 'Nudge left 1px',      category: 'edit',       action: () => /* nudge */ },
  { combo: 'arrowright',    description: 'Nudge right 1px',     category: 'edit',       action: () => /* nudge */ },
  { combo: 'shift+arrowup', description: 'Nudge up 10px',       category: 'edit',       action: () => /* nudge */ },
  /* ... */
  { combo: 'tab',           description: 'Cycle selection forward',  category: 'navigation', action: () => /* cycle */ },
  { combo: 'shift+tab',     description: 'Cycle selection backward', category: 'navigation', action: () => /* cycle */ },
  { combo: '[',             description: 'Send backward',       category: 'edit',       action: () => /* reorder */ },
  { combo: ']',             description: 'Bring forward',       category: 'edit',       action: () => /* reorder */ },
  { combo: 'w',             description: 'Toggle wireframe',    category: 'view',       action: () => /* toggle */ },
  { combo: '?',             description: 'Show keyboard shortcuts', category: 'help',   action: () => /* open cheat sheet */ },
];
```

3. **Cheat sheet modal** (`app/shell/KeyboardShortcutsModal.tsx`): grouped by category, with `Esc` to close. Triggered by `?` key.

4. **Surface entry points to the cheat sheet**:
   - `?` keyboard shortcut.
   - A `(?)` icon button at the bottom of the LeftRail (replacing or supplementing the gear "More" button).
   - Mention in the empty-state of any panel ("Press ? for shortcuts").

5. **Pan-mode (Space held)**: special-case because it's a *modifier*, not a one-shot. Implement separately:

```ts
useEffect(() => {
  const onDown = (event: KeyboardEvent) => {
    if (event.code === 'Space' && !isEditableTarget(event.target)) {
      event.preventDefault();
      uiActions.setPanMode(true);
    }
  };
  const onUp = (event: KeyboardEvent) => {
    if (event.code === 'Space') uiActions.setPanMode(false);
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
  };
}, [uiActions]);
```

### Acceptance criteria

- Pressing `Cmd+Z` after moving a widget reverts the move.
- Pressing `?` (without Shift) opens the cheat sheet modal.
- The cheat sheet groups shortcuts by category (Edit / Navigation / View / File / Help).
- The cheat sheet displays current OS-correct modifiers (`⌘Z` on Mac, `Ctrl+Z` on Windows/Linux).
- Holding Space (when not typing) activates pan-mode; releasing deactivates it.
- Pressing `Tab` while a widget is selected moves selection to the next visible widget by z-order.
- Pressing arrow keys with a widget selected moves it 1px (10px with Shift). Movement appears in the undo history (each arrow press is a separate undo entry, or grouped if pressed in rapid succession — implement as you see fit).
- Cheat sheet is accessible via the `?` button in the LeftRail bottom area.

---

# Phase D — Strategic gaps

These are **production-parity** gaps with Celtra, Bannerflow, Connected Stories. Without these, Studio is positioned as "single-banner editor", not "rich-media production studio". Each is multi-day work and should land as its own sprint, not bundled.

---

## D1 — Multi-size workspace (size sets)

**Severity**: 🔴 blocker (product-level) · **Surface**: domain, shell, export · **Effort**: XL

### Context

Today a project has one canvas. Production rich-media campaigns ship as size sets: a master (e.g. 300×600) and adapted variants (300×250, 728×90, 320×50, 970×250). All sizes must:
- Share assets and copy.
- Have independent layouts with safe-area constraints.
- Animate consistently (same key animation, adapted to size).
- Export as a single bundle.

This is the largest competitive gap.

### Fix (high level — split into multiple sprints)

**D1.1 — Domain model**:

Extend `StudioState.document` to support multiple canvas variants:

```ts
type CanvasVariant = {
  id: string;
  label: string;
  width: number;
  height: number;
  isMaster: boolean;
};

type Document = {
  /* ... existing ... */
  canvasVariants: CanvasVariant[];           // at least one, the master
  activeCanvasVariantId: string;
  // widget overrides per canvas variant:
  widgetOverrides: Record<string /* variantId */, Record<string /* widgetId */, Partial<WidgetNode>>>;
};
```

The override pattern: a widget has a base `frame`, base `style`, base `keyframes`. Per-variant overrides only store what diverges. Editing in master propagates to variants unless the variant has an override.

**D1.2 — Variant switcher UI**:

Add a horizontal strip at the top of the workspace (between topbar and stage):

```
┌─────────────────────────────────────────────────────────────────────┐
│  ★ 300×600 (master)  ·  300×250  ·  728×90  ·  320×50  ·  + Add size │
└─────────────────────────────────────────────────────────────────────┘
```

Each chip = one variant. Star = master. Active variant has stronger highlight. Click switches active variant. Right-click for context menu (Set as master / Delete / Duplicate / Rename).

**D1.3 — Auto-layout suggestions**:

When adding a new size, offer common adaptations:
- "Center crop": preserve master positions proportionally.
- "Fit": scale down assets to fit.
- "Stack": rearrange vertically (for 320×50 from 300×600).

**D1.4 — Override visualization**:

In the inspector, show a small "M" (master) badge next to any property whose value comes from the master. When the user edits, show a "✱" badge to indicate this variant has a local override. Allow "Reset to master" per property.

**D1.5 — Bundle export**:

`Export ZIP` becomes "Export size set". The output ZIP has:
```
bundle/
  300x600/index.html
  300x600/assets/...
  300x250/index.html
  300x250/assets/...
  shared/assets/...   (assets used by ≥2 variants)
  manifest.json       (lists variants and metadata)
```

### Acceptance criteria

- Creating a project with a 300×600 canvas, then adding a 300×250 variant, produces 2 chips in the variant switcher.
- Editing a widget's text in the master propagates to the 300×250 variant.
- Editing a widget's frame in the 300×250 variant creates a local override; the master is unchanged.
- Resetting a property's override on the variant restores it to the master's value.
- Exporting the project produces a bundle ZIP with both sizes.

(This is intentionally a sketch. The detailed design should be written as a separate RFC document — `STUDIO-MULTI-SIZE-RFC-2026-XX-XX.md` — before implementation begins.)

---

## D2 — Inspect/Override per scene (parallel to D1, optional sprint)

**Severity**: 🟡 medium · **Surface**: domain, inspector · **Effort**: L

### Context

The same widget (e.g., a logo) appears across multiple scenes. Today, editing it in scene 2 does not affect scene 1 — they are separate widgets. But often the designer wants the logo to be the same across all scenes, with only one or two scenes having an exception.

### Fix

Introduce a "shared layer" concept: a widget that is shared across all scenes by default, with per-scene overrides. Conceptually similar to D1 but for scene axis.

The model:

```ts
type SharedWidgetLayer = {
  id: string;
  baseNode: WidgetNode;
  perSceneOverrides: Record<string /* sceneId */, Partial<WidgetNode>>;
};
```

Visual indicator: shared layers render with a "stack" icon in the layers panel and timeline.

This can be deferred until D1 lands; D1 establishes the override pattern and D2 reuses it.

### Acceptance criteria

- A "Convert to shared layer" action on a single-scene widget copies it to all scenes with shared identity.
- Editing the shared layer in scene 1 propagates to scenes 2, 3, ... unless they have local overrides.

---

## D3 — Live device preview frame

**Severity**: 🟡 medium · **Surface**: stage, preview · **Effort**: M

### Context

Designers need to see how the banner renders in context: inside a phone frame, inside a webpage simulator, inside an in-app placement. Today, preview is just the canvas zoomed to 100%.

### Fix

In Preview mode (toggled from topbar), wrap the stage in an optional device frame:

- Phone (iPhone 14, Pixel 8): renders the banner inside a phone bezel, at the size it would appear in an in-app placement.
- Browser: renders the banner inside a fake article page, mimicking placement context.
- None (current behavior): just the canvas.

Implement by adding a `previewContext` option to `uiActions`, with the stage rendering different chrome around the canvas based on the value.

Available frames should be defined as data in `domain/preview/preview-frames.ts`:

```ts
export const PREVIEW_FRAMES = [
  { id: 'none',     label: 'No frame',    type: 'plain' },
  { id: 'iphone14', label: 'iPhone 14',   type: 'mobile', chromeWidth: 390, chromeHeight: 844, safeAreaTop: 47, safeAreaBottom: 34 },
  { id: 'pixel8',   label: 'Pixel 8',     type: 'mobile', chromeWidth: 412, chromeHeight: 915, /*...*/ },
  { id: 'article',  label: 'Article page', type: 'web',   chromeWidth: 1024, chromeHeight: 768, articleTemplate: 'news' },
];
```

### Acceptance criteria

- Selecting "iPhone 14" in preview mode wraps the canvas with a phone bezel.
- The banner inside the phone is positioned correctly (e.g., a 320×480 banner appears at native size, not stretched).
- Switching back to "No frame" returns to the current behavior.
- The frame selection is persisted across sessions per project.

---

# Phase E — Contracts & scaling

These tighten the architecture so that future widgets and panels can be added without touching the shell.

---

## E1 — Widget capability extensions for production metadata

**Severity**: 🟡 medium · **Surface**: contracts · **Effort**: S

### Context

`WidgetCapabilities` (already exists, line 48–63 of `widget-definition.ts`) is a clean boolean map. But several capabilities production code needs are not modeled. They should be added now to avoid scattered ad-hoc checks later.

### Fix

Extend the type:

```ts
export type WidgetCapabilities = {
  // existing
  acceptsImageAsset?: boolean;
  acceptsVideoAsset?: boolean;
  acceptsFontAsset?: boolean;
  acceptsAssetSwap?: boolean;
  hasFill?: boolean;
  hasAccentColor?: boolean;
  isMedia?: boolean;
  isInteractive?: boolean;
  exposesActions?: boolean;
  isContainer?: boolean;
  hasVideoAnalytics?: boolean;
  hasTextVariant?: boolean;
  hasTitleVariant?: boolean;
  isAssetGallery?: boolean;

  // NEW
  /** Whether this widget reads or writes external network resources at runtime. */
  performsNetworkIo?: boolean;

  /** Whether this widget can be safely included in offline-first placements. */
  worksOffline?: boolean;

  /** Whether this widget needs MRAID host capabilities (open URL, expand, resize). */
  requiresMraidHost?: boolean;

  /** Whether this widget should be excluded from accessibility-strict placements. */
  hasInaccessibleInteractions?: boolean;

  /** Whether this widget has runtime randomness or per-impression state (impacts caching). */
  hasRuntimeRandomness?: boolean;
};
```

Each new capability should be checked into the preflight runner (Phase C4).

### Acceptance criteria

- New capabilities exist in the type and are populated for at least 5 widgets as exemplars.
- Preflight has a new check that warns if `performsNetworkIo: true` and the export channel is `criteo` (which restricts external IO).
- TypeScript prevents misspellings — adding `acceptsAssetSwap2` to a definition fails to compile.

---

## E2 — Inspector section registry: add per-section visibility predicate

**Severity**: 🟢 polish · **Surface**: contracts, inspector · **Effort**: S

### Context

Today, `inspectorSections: InspectorSectionKey[]` is a flat list. Some sections should only show conditionally (e.g., "Variants" only when there's a data binding active; "Video Analytics" only when video is the source).

### Fix

Allow each section to be either a key or an object with a predicate:

```ts
export type InspectorSectionEntry =
  | InspectorSectionKey
  | { key: InspectorSectionKey; visibleWhen: (node: WidgetNode, state: StudioState) => boolean };

export type WidgetDefinition = {
  /* ... */
  inspectorSections: InspectorSectionEntry[];
  /* ... */
};
```

In `widget-inspector-layout.tsx`, the resolver normalizes each entry and filters by the predicate when present.

This is **non-breaking**: existing definitions with `InspectorSectionKey[]` continue to work because the type is a union.

### Acceptance criteria

- A widget with a conditional section ("Variants" visible only when `widget.dataBindings.length > 0`) hides the section dynamically when the binding is removed.
- All existing widget definitions compile without modification.

---

## E3 — Theme tokens: deduplicate transparency aliases

**Severity**: 🟢 polish · **Surface**: theme · **Effort**: S

### Context

`theme.css` has `--white-a-XX` and `--accent-a-XX` ladders with both standard increments (`-04`, `-08`, `-12`, `-18`, `-24`, ...) and oddball ones (`-012`, `-015`, `-016`, `-018`, `-024`, `-025`, `-028`, `-035`, `-045`). The oddballs often correspond to ad-hoc values introduced for one-off shadows or backgrounds. They duplicate the rounding ladder and dilute the system.

### Fix

1. **Audit**: grep the codebase for usages of each oddball variable. If a variable is used in 1–2 places, replace those usages with the nearest standard variable and delete the oddball.

```bash
cd apps/studio
for var in white-a-012 white-a-015 white-a-016 white-a-018 white-a-024 white-a-025 white-a-028 white-a-035 white-a-045; do
  echo "=== $var ==="
  rg --no-heading "$var" src --count | head -5
done
```

2. **Promote**: any variable used in 5+ places is canonical and stays.

3. **Document**: add a comment block at the top of the transparency ladder section in `theme.css`:

```css
/*
 * Transparency ladder.
 *
 * Standard tokens use percentage-based names: --white-a-04 = 4% opacity.
 * Use these by default. They form a coherent ladder: 04, 08, 12, 18, 24, 28, 35, 45, 55, 75, 85, 90, 95, 96.
 *
 * If a designer needs a value not on the ladder, propose adding it to the standard ladder
 * rather than introducing a one-off. The goal is ≤ 16 transparency tokens per color.
 */
```

4. **Lint**: add a stylelint rule disallowing direct `rgba(255, 255, 255, ...)` outside `theme.css`. The existing repo already has hex/rgba banned in shared styles per the audit notes — extend it to other surfaces gradually.

### Acceptance criteria

- The number of `--white-a-*` tokens decreases or stays equal (no new ones added during this task).
- All oddball variables that had ≤ 2 usages are removed.
- A stylelint check warns when a developer introduces a literal `rgba(...)` in any file under `src/shared/styles/`.
- Visual diff of the app shows no perceptible regression.

---

# Sprint sequencing recommendation

**Sprint S56 (1 week)** — Phase A only. Hot bugs. No risk, all wins.
- A1, A2, A4, A6, A7 in 1–2 days
- A3 (Tooltip portal) in 1 day
- A5 (resize throttle) in 1 day
- Buffer / regression testing

**Sprint S57 (1 week)** — Phase B + start C.
- B1 (button consolidation) — 1 day
- B2, B3, B4 — 1 day
- C2 (scene strip in timeline) — 1 day
- C5 (keyboard shortcuts + cheat sheet) — 2 days

**Sprint S58 (1 week)** — Finish C.
- C1 (topbar reorganization) — 2 days
- C3 (widget library cards + previews) — 2 days
- C4 (preflight tray) — 1 day

**Sprint S59 onward** — Phase D and E. D1 should be its own RFC + 2-sprint effort. D2 and D3 are polish layers that can land in any sprint.

---

# Sanity checklist for CODEX before starting any item

For each item, before opening a PR:

- [ ] Read the linked source files in their current form (the audit was generated against Sprint 55 closeout — files may have moved or evolved by the time this is executed).
- [ ] Confirm the bug or improvement is still present.
- [ ] Run `npm run typecheck -w @smx/studio` before and after — must remain green.
- [ ] Run `npm run lint:css -w @smx/studio` before and after — must remain green.
- [ ] Run `npm run test -w @smx/studio` and add tests for the new behavior where listed in Acceptance criteria.
- [ ] Run `npm run build -w @smx/studio` — confirm no new bundle warnings, main chunk size does not regress beyond ~5 KB without justification.
- [ ] Visual diff: take a before/after screenshot of the relevant surface. Attach to the PR.

---

# Out of scope for this plan

The following are intentionally not included here. They may be valid work, but they belong in different documents:

- Refactoring widget renderers (`widgets/modules/*.renderer.tsx`) to remove inline styles. The audit notes already identify the hot files; this work is a separate "render layer cleanup" RFC.
- Internationalization (i18n) of strings.
- Dark/light theme toggle. The product is dark-only today by design.
- Mobile / touch-tablet layout adaptation.
- Server-driven UI experiments.

---

*End of plan.*
