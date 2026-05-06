# Changelog — DUSK design system

## v2 fix (post-audit, 2026-05-06)

After the bundle was applied to the repo, a post-implementation audit
flagged 3 issues. This patch resolves all three.

### Fixed

- **Routing collision in `/settings/*`** — the bundle's `App.tsx`
  declared `/settings/*` (mine, generic) AND `/settings/api-keys`,
  `/settings/audit-log`, `/settings/workspace`, `/settings/webhooks`
  (real repo modules) as siblings. Depending on react-router-dom's
  matching behaviour either the real CRUD modules became unreachable,
  or the placeholder tabs became dead links.
  - **Fix:** rewrote `pages-refactored/Settings.tsx` as a tab shell that
    lazy-loads the real repo modules (`team/WorkspaceSettings`,
    `webhooks/WebhookManager`, `api-keys/ApiKeys`, `audit/AuditLog`)
    into the matching tabs. Profile, Security and Notifications remain
    owned by the shell since they're per-user preferences. Active tab
    is derived from `location.pathname`.
  - **Fix:** removed 4 colliding `<Route path="/settings/...">` entries
    from `App.tsx`. Now there's a single `/settings/*` route plus a
    redirect from `/settings` → `/settings/profile`.
  - **Added:** `ScrollText` icon to the system barrel for the Audit log tab.

- **Tag sub-pages were route-orphaned** — `/tags/:id/health`,
  `/tags/:id/pixels`, `/tags/:id/tracking`, `/tags/:id/reporting` and
  `/tags/bindings` were registered in `App.tsx` but nothing in the UI
  linked to them.
  - **Fix:** `TagBuilder.tsx` now shows a "More for this tag" panel
    after the form, with 4 cards linking to each sub-page (Health,
    Pixels, Tracking, Reporting). Visible only when editing an existing
    tag (`isEdit && id`).
  - **Fix:** `TagList.tsx` adds a "Bindings" button in the page header
    linking to `/tags/bindings`.

- **5 legacy pages still on the old style system** — `team/WorkspaceSettings`,
  `webhooks/WebhookManager`, `api-keys/ApiKeys`, `tags/TagBindingDashboard`,
  `tags/TagPixelsManager` (plus `tags/TagList`, `campaigns/CampaignList`,
  and `shared/dusk-ui`) had `bg-indigo-*`, `bg-red-50`, `text-slate-*`
  patterns instead of design system tokens.
  - **New script:** `scripts/replace-status-and-slate.mjs` — stage-2
    codemod handling status badges (`bg-green-100/text-green-800` →
    `var(--dusk-status-success-{bg,fg})`), error banners, slate surface
    variants (`bg-slate-50` → `var(--dusk-surface-muted)`), foreground
    status text, and `bg-indigo-400`/`disabled:bg-indigo-400` leftovers
    that the stage-1 codemod doesn't catch.
  - **Migrated** with stage-1 + stage-2 codemod and minimal manual
    cleanup (8 files):

    | File | Stage-1 edits | Stage-2 edits | Manual fixes |
    |---|---:|---:|---|
    | `api-keys/ApiKeys.tsx` | 42 | 22 | none (terminal-style code block kept dark) |
    | `team/WorkspaceSettings.tsx` | 46 | 19 | tab active state `border-indigo-600` → `border-brand-500` |
    | `webhooks/WebhookManager.tsx` | 56 | 23 | none |
    | `tags/TagBindingDashboard.tsx` | 47 | 12 | error banner `bg-red-50` → status tokens |
    | `tags/TagPixelsManager.tsx` | 31 | 10 | error banner `bg-red-50` → status tokens |
    | `tags/TagList.tsx` | 97 | 16 | `text-slate-950 dark:text-white` → `text-text-primary` |
    | `campaigns/CampaignList.tsx` | 53 | 11 | same as above |
    | `shared/dusk-ui.tsx` | 57 | 17 | wrapper `bg-[#f6f3fb] text-slate-950 dark:bg-[#0b1020] dark:text-white` → `bg-bg text-text-primary` |

  - **Note:** the `bg-slate-900 text-green-400` block in `ApiKeys.tsx`
    is intentionally preserved — it's a terminal-style code display
    that should stay dark in both themes.

### Verification

```
$ node scripts/smoke-test.mjs apps/web
File presence: ✓
System imports: ✓ 42 files, 70 exports
Icon barrel: ✓ 97 icons
Direct lucide: ✓
Legacy colors: ✓ in refactored code
Tokens dark mode: ✓
✓ SMOKE TEST PASSED — package is ready to install
```

Was: 1 warning with 5 files flagged.
Now: 0 errors, 0 warnings.

### Known follow-up (not addressed in v2)

`find-duplications.mjs` still reports 4 *structural* issues (not legacy
colors):

- Inline `<MetricCard>` definitions in `tags/TagList.tsx` (1 site) and
  `campaigns/CampaignList.tsx` (1 site) — should reuse `<MetricCard>`
  from `@/system`.
- Inline `<Sparkline>` definitions in same 2 files — should reuse
  `<Sparkline>` from `@/system`.
- Hardcoded brand-gradient string (`linear-gradient(... #F1008B ...)`)
  in `tags/TagList.tsx`, `campaigns/CampaignList.tsx`, `shared/dusk-ui.tsx`
  — should use `var(--dusk-brand-gradient)`.

These are component-level refactors, not regex substitutions, so they
were left as-is to avoid scope creep. ~30 min each.

---


> Base: `codex/s50-staging-rc`

## Added

### Design system (`apps/web/src/system/`)
- `tokens.css` — full token system (colors, spacing, radius, shadow, type, z-index, motion, layout). Light + dark.
- `cn.ts` — class-name composer.
- Primitives: `Button`, `IconButton`, `Panel`, `PanelHeader`, `Input`, `FormField`, `Select`, `Badge`, `Kicker`, `Tabs`, `Modal`, `Skeleton`, `Spinner`, `EmptyState`, `MetricCard`, `Sparkline`.
- `data-table/DataTable.tsx` — sortable, dense-able, selectable headless table with sticky header and bulk actions.
- `feedback/Toast.tsx` — `<ToastProvider>` + `useToast()`. Auto-dismiss, action buttons, 5 tones.
- `feedback/Confirm.tsx` — `<ConfirmProvider>` + `useConfirm()` Promise-returning hook with optional type-to-confirm.
- `icons/index.ts` — curated lucide-react re-exports (~70 icons).
- `index.ts` — single public barrel.

### Shell (`apps/web/src/shell/`)
- `AppShell.tsx` — full-screen layout with sidebar (desktop) + drawer (mobile) and TopBar.
- `Sidebar.tsx` — 11-item nav across 3 groups (Operations / Monitoring / Platform). All previously-hidden routes (Tools, Settings, Experiments, Clients) are now visible.
- `TopBar.tsx` — global chrome: workspace switcher, search trigger (Cmd+K), theme toggle, notifications, user menu.
- `DuskLogo.tsx` — extracted reusable wordmark.
- `Shell.tsx` — replaces legacy `src/Shell.tsx`. Auth wiring + route guard preserved; hardcoded campaign focus removed.

### Pages refactored (`apps/web/src/pages-refactored/`)
- `CampaignEditor.tsx` — 2-column form, sticky save bar, `FormField`-based validation, no indigo.
- `TagBuilder.tsx` — Setup / Activity / Tracking tabs. Lucide icons replace 📊 📈 🔗.
- `CreativeApproval.tsx` — `DataTable`, `Modal` preview, `useConfirm` for destructive reject, `useToast` feedback.
- `AbExperimentEditor.tsx` — Lucide `BarChart3` / `Pause` / `Play` / `Stop` replace ▶ ⏸ ■. Variant editing inline. Results modal.

### App composition
- `App.tsx` — wraps in `<ToastProvider>` + `<ConfirmProvider>`. Routes refactored pages. New routes registered: `/experiments`, `/clients`, `/tools`, `/creatives/approval`. All pages lazy-loaded.

### Tooling
- `tailwind.config.js` — token-based utilities (`bg-surface-1`, `text-text-muted`, `border-border-default`, `shadow-2`, `bg-brand-gradient`, etc.).
- `index.css` — refactored. Loads Inter + JetBrains Mono via `@fontsource-variable`. Universal focus-visible ring. Page-chrome utilities. **Legacy compat block** (marked DELETE-ON-MIGRATION) softens `bg-indigo-*` etc. mid-migration.

### ESLint plugin (`/eslint-rules/`)
- `no-legacy-tailwind-colors` — bans `bg-indigo-*`, `bg-green-600`, `bg-red-600`, etc.
- `no-deep-system-imports` — forces use of `@/system` barrel.
- `no-emoji-icons` — bans emojis in JSX text.
- `prefer-design-system-button` — bans inline gradient `<button>` for primary actions.
- `index.js` aggregator + `.eslintrc.example.json`.

### Documentation (`/docs/`)
- `MIGRATION.md` — step-by-step migration from S50.
- `DESIGN_SYSTEM.md` — usage reference for every primitive.
- `ARCHITECTURE.md` — layer model, import contracts, naming, a11y baseline.
- `CHANGELOG.md` — this file.

## Changed

- `Shell.tsx` (legacy `src/Shell.tsx` → `src/shell/Shell.tsx`) — same contract, new chrome. Deletes hardcoded badge counts, hardcoded campaign focus, hardcoded mock notifications. The user/workspace selector logic is preserved 1:1.
- Tipografía — system-ui replaced by Inter + JetBrains Mono. Numeric columns and metric values automatically tabular-nums.
- Focus rings — every focusable element now uses the same 3px brand glow via `box-shadow: var(--dusk-focus-ring)`.

## Deprecated

- `apps/web/src/shared/dusk-ui.tsx` — keep for now (Gen-B pages still import from it). Mark for deletion once those pages migrate.
- `window.confirm()` — use `useConfirm()`.
- Inline error banners for save failures — use `useToast({ tone: 'critical' })`.

## Removed

- Hardcoded fake badge counts in sidebar.
- Hardcoded "campaign focus" decoration in legacy Shell.
- Per-page workspace selectors that duplicated the topbar's responsibility (consolidate as you migrate each page).

## Migration impact

| Bucket                           | Files | Status                         |
|----------------------------------|-------|--------------------------------|
| Already on system (Gen-A)        | ~12   | OK as-is, can deepen           |
| Hardcoded but visually aligned   | ~14   | Migrate per Step 6 of MIGRATION |
| Legacy 2023 indigo               | 4     | Refactored in `pages-refactored/` |
| 3,217-line CreativeLibrary       | 1     | Split first, then migrate      |

## Known follow-ups

- Command palette (Cmd+K) — topbar shows the trigger; the actual palette is a follow-up.
- CreativeLibrary needs a structural split before refactor.
- Reporting / PacingDashboard charts — keep their existing libs; only their containers were tokenised.
- Onboarding empty-states — most pages have skeleton loading but not all have proper empty states yet.
