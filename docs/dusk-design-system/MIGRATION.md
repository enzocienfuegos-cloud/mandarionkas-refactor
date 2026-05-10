# DUSK Adserver — Migration Guide (S50 → S56)

> Branch base: `codex/s50-staging-rc`
> Target branch: `codex/s56-design-system`
> Scope: full UI/UX overhaul across `apps/web`. Backend untouched.

This zip is meant to land on top of `apps/web` in your existing monorepo.
Nothing outside `apps/web` is modified. No backend, worker, or contracts code is touched.

---

## TL;DR — what changes

1. **One** design system, **one** Button, **one** Panel, **one** MetricCard, **one** DataTable.
2. **Global Topbar** with workspace switcher, search, theme, notifications, user — replaces every per-page toolbar variant.
3. **Sidebar** lists all 11 destinations (Tools, Settings, Experiments, Clients are no longer hidden).
4. **Toast + Confirm** are global. `window.confirm()` and bespoke alert UIs are deprecated.
5. **Tipografía**: Inter (body + display) + JetBrains Mono (numerics, IDs, code).
6. **Tokens**: light + dark theme through CSS variables. No more 297 lines of `!important` patches.
7. **ESLint rules** keep regression from sneaking back in.

---

## What's in this zip

```
apps/web/
├── tailwind.config.js                         REPLACE
├── package.partial.json                       MERGE deps into existing package.json
└── src/
    ├── index.css                              REPLACE
    ├── App.tsx                                REPLACE
    ├── system/                                NEW — design system
    │   ├── tokens.css
    │   ├── cn.ts
    │   ├── index.ts                           ← public barrel: import { ... } from '@/system'
    │   ├── icons/index.ts
    │   ├── primitives/{Button,Panel,Input,Select,Badge,Tabs,Modal,Skeleton,Spinner,EmptyState,MetricCard}.tsx
    │   ├── data-table/DataTable.tsx
    │   └── feedback/{Toast,Confirm}.tsx
    ├── shell/                                 NEW — app chrome (sidebar + topbar)
    │   ├── AppShell.tsx
    │   ├── Sidebar.tsx
    │   ├── TopBar.tsx
    │   ├── DuskLogo.tsx
    │   └── Shell.tsx                          REPLACES src/Shell.tsx (route guard preserved)
    └── pages-refactored/                      DROP-IN replacements
        ├── CampaignEditor.tsx
        ├── TagBuilder.tsx
        ├── CreativeApproval.tsx
        └── AbExperimentEditor.tsx

eslint-rules/                                  NEW — local plugin
├── index.js
├── no-legacy-tailwind-colors.js
├── no-deep-system-imports.js
├── no-emoji-icons.js
├── prefer-design-system-button.js
└── .eslintrc.example.json

docs/                                          NEW
├── MIGRATION.md (this file)
├── DESIGN_SYSTEM.md
├── ARCHITECTURE.md
└── CHANGELOG.md
```

---

## Step 1 — install dependencies

```bash
cd apps/web
npm install \
  @fontsource-variable/inter \
  @fontsource-variable/jetbrains-mono \
  lucide-react@^0.453.0
```

`lucide-react` may already be in your tree — upgrade if older than 0.453.

---

## Step 2 — drop the new files

From the unzipped folder, copy:

```bash
# from the zip root
cp -r apps/web/src/system        <repo>/apps/web/src/
cp -r apps/web/src/shell         <repo>/apps/web/src/
cp -r apps/web/src/pages-refactored <repo>/apps/web/src/
cp    apps/web/tailwind.config.js   <repo>/apps/web/
cp    apps/web/src/index.css        <repo>/apps/web/src/
cp    apps/web/src/App.tsx          <repo>/apps/web/src/
cp -r eslint-rules                  <repo>/
```

> ⚠️ **Conflict expected:** `apps/web/src/Shell.tsx` was the legacy one.
> The new shell lives at `apps/web/src/shell/Shell.tsx`. Delete the legacy file.

---

## Step 3 — alias resolution

The system uses `@/system` imports. Make sure `tsconfig.json` and `vite.config.ts` resolve `@/` to `src/`.

`apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

`apps/web/vite.config.ts`:

```ts
import path from 'node:path';
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

If you prefer not to use `@/`, change the imports inside `system/index.ts`, `shell/*`, and `pages-refactored/*` to relative paths.

---

## Step 4 — wire up the ESLint plugin

Append to `apps/web/.eslintrc.cjs`:

```js
const duskLocal = require('../../eslint-rules');

module.exports = {
  // ...existing,
  plugins: ['dusk-local'],
  rules: {
    'dusk-local/no-legacy-tailwind-colors':   'error',
    'dusk-local/no-deep-system-imports':      'error',
    'dusk-local/no-emoji-icons':              'warn',
    'dusk-local/prefer-design-system-button': 'error',
    'no-restricted-imports': ['error', {
      paths: [{
        name: 'lucide-react',
        message: "Import icons from '@/system/icons' instead.",
      }],
    }],
  },
};
```

Run `npx eslint apps/web/src` — the existing legacy pages will throw violations. That's expected; deal with them in step 6.

---

## Step 5 — replace the four refactored pages

The refactored versions are in `pages-refactored/`. They're API-compatible drop-ins for the legacy versions in `pages/`. Two options:

**Option A (recommended)** — wire them through `App.tsx`. The new `App.tsx` already imports from `pages-refactored/`. If you keep the legacy pages alongside (e.g. for diffing) they'll just be unused.

**Option B (gradual)** — flag-gate them in App.tsx with a localStorage flag. Not necessary; the refactors are pure UI.

After step 5, these 4 routes are using the design system:

- `/campaigns/:id` → `pages-refactored/CampaignEditor.tsx`
- `/tags/:id`       → `pages-refactored/TagBuilder.tsx`
- `/creatives/approval` → `pages-refactored/CreativeApproval.tsx`
- `/experiments/:id` → `pages-refactored/AbExperimentEditor.tsx`

---

## Step 6 — migrate remaining legacy pages

The legacy pages still in `pages/` (CampaignList, TagList, CreativeLibrary, AdOpsOverview, PacingDashboard, DiscrepancyDashboard, etc.) already render — the legacy-color compat block in `index.css` keeps them visually consistent. But they will throw ESLint warnings.

Suggested order, smallest first:

1. `Login` — usually 1 form. ~30 min.
2. `Launcher` — 1-2 cards.
3. `Settings` — replace its inputs with `<Input>` and tabs with `<Tabs>`. ~1h.
4. `AdOpsOverview` — replace its inline `MetricCard` and `Sparkline` with the system ones.
5. `CampaignList` / `TagList` — replace their inline tables with `<DataTable>`.
6. `CreativeLibrary` — the **3,217-line god component**. Split first; it has 29 useStates and 36 functions. Split into: `CreativeLibraryHeader`, `CreativeFilters`, `CreativeGrid`, `CreativeUploadModal`, `CreativeAssignmentPanel`. Each piece can then adopt the system independently.
7. `PacingDashboard` / `DiscrepancyDashboard` — same pattern as CampaignList.

After each page is migrated, the legacy block in `index.css` is one step closer to deletable.

---

## Step 7 — delete the legacy compat block

Once every page passes lint clean, delete the block at the bottom of `index.css` marked `/* Legacy color compatibility */`. ESLint will guarantee nothing depends on it. Final visual test in light + dark.

---

## Step 8 — replace `window.confirm` everywhere

Search:

```bash
grep -rn "window.confirm\|confirm(" apps/web/src --include="*.tsx" --include="*.ts"
```

Replace with:

```tsx
import { useConfirm } from '@/system';
const confirm = useConfirm();
const ok = await confirm({
  title: 'Delete X?',
  description: 'This cannot be undone.',
  tone: 'danger',
});
if (!ok) return;
```

For destructive actions on named entities, use `requireTypeToConfirm`:

```tsx
const ok = await confirm({
  title: 'Delete this campaign?',
  tone: 'danger',
  requireTypeToConfirm: campaign.name,
});
```

---

## Step 9 — replace ad-hoc toast / inline error banners

Wherever a page sets local state `error: string` then renders a red banner, replace with:

```tsx
import { useToast } from '@/system';
const { toast } = useToast();

try {
  await save();
  toast({ tone: 'success', title: 'Saved' });
} catch (e) {
  toast({ tone: 'critical', title: 'Could not save', description: String(e) });
}
```

---

## Step 10 — verify

```bash
cd apps/web
npm run lint          # zero errors expected (legacy pages may still warn until migrated)
npm run typecheck     # must pass
npm run build         # must pass
npm test              # must pass
```

Then visual QA in **both** light and dark themes:

- Sidebar — all 11 items visible, no fake badges.
- Topbar — workspace switcher works, theme toggle persists.
- Forms — focus rings consistent (3px brand glow).
- Data tables — sorting, density, selection, sticky header.
- Modals — ESC closes, Tab is trapped, focus returns to trigger.
- Toasts — auto-dismiss after 4.5s, action button when present.
- Mobile (<1024px) — sidebar becomes drawer.

---

## Rollback

Everything is additive except `index.css`, `tailwind.config.js`, `App.tsx` and `Shell.tsx`. To roll back: revert those four files and remove the new folders. Backend is untouched.

---

## What was deliberately NOT done

- **Command palette (Cmd+K)** — the topbar has the trigger and shortcut hint, but the palette itself is a follow-up sprint.
- **CreativeLibrary refactor** — 3,217 lines is too large to refactor blind; recommend splitting into 5 files first (see Step 6).
- **Settings sub-pages** — inherit the new shell automatically; their internal forms still need pass-through.
- **Charts beyond Sparkline** — full-size charts (PacingDashboard, Reporting) keep their existing libs; only their containers were tokenised.

These are the natural follow-up sprint targets.
