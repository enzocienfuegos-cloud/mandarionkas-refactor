# Changelog — S56: Design System & Shell

> Branch: `codex/s56-design-system` (target)
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
