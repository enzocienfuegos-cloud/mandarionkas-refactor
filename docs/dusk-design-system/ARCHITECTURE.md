# DUSK Adserver — Frontend Architecture

## Layered architecture

```
┌──────────────────────────────────────────────────────────┐
│ Pages                                                     │
│   - Compose primitives + DataTable + feedback to express │
│     a single screen. Hold local state, call the API.     │
│   - Never style with raw colors; never write a Modal     │
│     by hand; never duplicate a MetricCard.                │
└────────────────────────────────────────┬─────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────┐
│ Shell (apps/web/src/shell)                                │
│   - AppShell: layout (sidebar + topbar + outlet)          │
│   - Sidebar: nav tree (single source of truth)            │
│   - TopBar:  workspace + search + theme + notifs + user   │
│   - Shell:   route guard + auth wiring + theme store      │
└────────────────────────────────────────┬─────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────┐
│ Design System (apps/web/src/system)                       │
│   primitives/   Button, Panel, Input, Select, Badge,      │
│                 Tabs, Modal, Skeleton, Spinner,           │
│                 EmptyState, MetricCard                    │
│   data-table/   DataTable                                 │
│   feedback/     Toast, Confirm                            │
│   icons/        curated lucide re-exports                 │
│   index.ts      public barrel — only public API           │
└────────────────────────────────────────┬─────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────┐
│ Tokens (apps/web/src/system/tokens.css)                   │
│   - CSS custom properties for colors, space, radius,      │
│     shadow, type, z-index, motion, layout.                │
│   - Light + Dark theme overrides.                         │
│   - Single source of truth.                               │
└────────────────────────────────────────┬─────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────┐
│ Tailwind config                                            │
│   - Maps tokens to utility class names.                   │
│   - Means primitives can use bg-surface-1, text-muted,    │
│     border-default and they auto-respect dark mode.       │
└──────────────────────────────────────────────────────────┘
```

## Why layers

Before this refactor the codebase had three coexisting generations of UI:
- **Gen A** — current Dusk (`Sidebar`, `Panel`, `PrimaryButton` in `shared/dusk-ui.tsx`)
- **Gen B** — Dusk-flavored hardcoded (CampaignList, TagList) — visually right, but rewriting components inline
- **Gen C** — legacy 2023 (CampaignEditor, TagBuilder, CreativeApproval) — `bg-indigo-600`, emojis as icons

64 indigo references in 14 files, 8 hardcoded brand-gradient buttons, 52 cross-file utility duplications (MetricCard alone existed in 6 places).

Layering enforces that:
- A page can't bypass the system (ESLint rule `no-deep-system-imports`).
- A primitive can't bypass tokens (no raw color literals — they live only in `tokens.css`).
- A token can't drift from light/dark (every token has both definitions in `tokens.css`).

## Import contracts

| From folder              | Allowed to import from         |
|--------------------------|--------------------------------|
| `system/`                | `system/` (siblings only)      |
| `shell/`                 | `system/` (via barrel only), `shared/` |
| `pages-refactored/`      | `system/` (via barrel only), `shared/`, `pages/` (only when continuing flow) |
| `pages/`                 | (legacy — being migrated)      |

Enforced by `no-deep-system-imports` and `no-restricted-imports`.

## State

- **Shell-level state** (user, workspace, theme): owned by `Shell.tsx`, passed via `useOutletContext`.
- **Page-level state** (filters, selection, edits): local `useState` in the page; never hoisted.
- **Toasts and confirms**: provider-driven imperative API (`useToast()`, `useConfirm()`).
- **No Redux / Zustand store** at this layer. Server state via plain `fetch` (or your existing `useSWR` if present).

## Theming

- `<html class="dark">` toggles dark mode globally.
- The toggle is owned by `Shell.tsx`, persisted via `savePreference('dusk:theme', …)`.
- All visuals respect dark via tokens. Pages never write `dark:` overrides.

## Naming conventions

- **Components**: `PascalCase.tsx`, one component per file (excepting tightly coupled subcomponents like `PanelHeader` inside `Panel.tsx`).
- **Hooks**: `useFooBar`, exported from where they're defined.
- **Tokens**: `--dusk-{category}-{role}-{state?}`.
- **Tailwind classes**: prefer token-mapped (`text-muted`, not `text-gray-500`).

## Accessibility baseline

Every primitive ships with:
- `aria-*` attributes where appropriate (`aria-current`, `aria-modal`, `aria-invalid`, `aria-busy`, `aria-sort`).
- Focus-visible ring (3px brand glow) on every interactive element.
- Tab traversal order matching visual order.
- `role="dialog"` + focus trap on Modal.
- `prefers-reduced-motion` honored globally.

## Performance

- Every page is `React.lazy()` in `App.tsx` — first paint of the shell is small.
- `Suspense` boundary at the route level renders `CenteredSpinner` while a page chunk loads.
- Heavy assets (charts, the DataTable rendering thousands of rows) live in their own pages, not the shell bundle.

## Testing strategy (recommended)

- **Primitives**: snapshot + a11y check (jest-axe) — they're pure, easy to cover.
- **Shell**: integration test that a logged-in user with no ad-server access is redirected to `/launch`.
- **Pages**: cover the happy save path + one failure path. Don't test display details of primitives — they're already covered.

## Where to put new code

| You're building...                  | Put it in                                 |
|-------------------------------------|-------------------------------------------|
| A new page route                    | `apps/web/src/pages/`                     |
| A reusable form input variant       | `apps/web/src/system/primitives/`         |
| A new icon                          | Add to `apps/web/src/system/icons/index.ts` |
| A page-specific subcomponent        | Inline in the page file or a sibling file |
| A new hook used in 2+ places        | `apps/web/src/system/hooks/`              |
| Server-API client code              | `apps/web/src/shared/` (existing pattern) |

If you find yourself adding to two of these places at once, you probably want only one — pick the lower layer.
