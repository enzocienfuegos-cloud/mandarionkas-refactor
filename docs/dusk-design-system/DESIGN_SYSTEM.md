# DUSK Design System

Single source of truth for visual primitives. Always import from `@/system` — never reach into subfolders.

```tsx
import { Button, Panel, Badge, useToast, useConfirm } from '@/system';
```

---

## Tokens

All visual values are CSS custom properties in `tokens.css`.

| Category   | Names                                                                                    |
|------------|------------------------------------------------------------------------------------------|
| Brand      | `--dusk-brand-{50…950}`, `--dusk-brand-gradient`                                         |
| Surface    | `--dusk-bg`, `--dusk-surface-{1,2,muted,hover,active}`                                   |
| Text       | `--dusk-text-{primary,secondary,muted,soft,inverse,brand}`                               |
| Border     | `--dusk-border-{subtle,default,strong,focus}`                                            |
| Status     | `--dusk-status-{success,warning,critical,info,neutral}-{bg,border,fg}`                   |
| Shadow     | `--dusk-shadow-{1,2,3,4,overlay,brand}`                                                  |
| Radius     | `--dusk-radius-{sm,md,lg,xl,2xl,3xl,full}`                                               |
| Space      | `--dusk-space-{0,1,2,3,4,5,6,7,8,10,12,14,16,20}` (4px scale)                            |
| Type       | `--dusk-font-{display,body,mono}`, `--dusk-text-{xs…5xl}`                                |
| Motion     | `--dusk-duration-{fast,base,slow}`, `--dusk-ease-{standard,enter,exit}`                  |
| Z-index    | `--dusk-z-{dropdown,sticky,overlay,modal,toast,tooltip}`                                 |

Dark mode is automatic — `<html class="dark">` swaps every variable. **Never** write `dark:bg-…` overrides.

---

## Tailwind utilities

The Tailwind config maps tokens to utility names. Use these instead of raw Tailwind colors:

```html
<div class="bg-surface-1 text-text-primary border border-border-default">
<span class="text-text-muted">…</span>
<span class="text-text-brand">…</span>
<button class="bg-brand-500 hover:bg-brand-600">…</button>
<div class="bg-brand-gradient">…</div>
<div class="rounded-2xl shadow-2">…</div>
<div class="z-modal">…</div>
```

---

## Primitives

### Button

```tsx
<Button variant="primary" leadingIcon={<Plus />}>New campaign</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost" size="sm">Edit</Button>
<Button variant="danger" loading={isDeleting}>Delete</Button>
<Button variant="primary" fullWidth>Submit</Button>

<IconButton icon={<Settings />} aria-label="Settings" />
```

| Prop          | Type                                                | Default        |
|---------------|-----------------------------------------------------|----------------|
| `variant`     | `'primary' \| 'secondary' \| 'ghost' \| 'danger'`   | `'secondary'`  |
| `size`        | `'sm' \| 'md' \| 'lg'`                              | `'md'`         |
| `leadingIcon` | ReactNode                                           | —              |
| `trailingIcon`| ReactNode                                           | —              |
| `loading`     | boolean                                             | `false`        |
| `fullWidth`   | boolean                                             | `false`        |

### Panel

```tsx
<Panel padding="md">…</Panel>

<Panel padding="lg">
  <PanelHeader
    title="Settings"
    subtitle="Workspace-level configuration"
    actions={<Button variant="primary">Save</Button>}
  />
  …
</Panel>
```

| Prop        | Type                            | Default |
|-------------|---------------------------------|---------|
| `elevation` | `1 \| 2 \| 3`                   | `2`     |
| `padding`   | `'none' \| 'sm' \| 'md' \| 'lg'`| `'md'`  |
| `glass`     | boolean                         | `true`  |
| `as`        | tag name                        | `'section'` |

### Input + FormField

```tsx
<FormField label="Email" required helper="Used to send pacing alerts" htmlFor="email">
  <Input id="email" type="email" leadingIcon={<Mail />} />
</FormField>

<FormField label="Domain" error="Must be a valid hostname">
  <Input invalid value={domain} onChange={...} />
</FormField>
```

### Select

```tsx
<Select
  value={status}
  onChange={(e) => setStatus(e.target.value)}
  options={[
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
  ]}
/>
```

Or with native `<option>` children.

### Badge + Kicker

```tsx
<Badge tone="success">Live</Badge>
<Badge tone="warning" dot>Limited</Badge>
<Badge tone="critical" variant="solid">12 issues</Badge>
<Badge tone="info" leadingIcon={<Info />}>Beta</Badge>

<Kicker>Operations</Kicker>
```

| `tone`      | When to use                                      |
|-------------|--------------------------------------------------|
| `success`   | Positive state, healthy, live, approved          |
| `warning`   | Limited, paused, expiring soon                   |
| `critical`  | Error, blocked, rejected                         |
| `info`      | Informational, beta, experimental                |
| `neutral`   | Default state, not-started, unset                |
| `brand`     | Brand emphasis, highlighting                     |

### Tabs

```tsx
const [tab, setTab] = useState('general');

<Tabs value={tab} onValueChange={setTab}>
  <TabsList aria-label="Settings sections">
    <Tab value="general"  leadingIcon={<Settings />}>General</Tab>
    <Tab value="security" leadingIcon={<Shield />}>Security</Tab>
  </TabsList>
  <TabPanel value="general">…</TabPanel>
  <TabPanel value="security">…</TabPanel>
</Tabs>
```

Keyboard: arrow keys cycle, Home/End jump to ends.

### Modal

```tsx
const [open, setOpen] = useState(false);

<Modal
  open={open}
  onClose={() => setOpen(false)}
  title="Edit campaign"
  description="Changes apply immediately to live tags."
  size="lg"
  footer={
    <>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <Button variant="primary" onClick={handleSave}>Save</Button>
    </>
  }
>
  <FormField label="Name">
    <Input value={name} onChange={(e) => setName(e.target.value)} />
  </FormField>
</Modal>
```

Focus trap, ESC, body scroll lock, backdrop click — all built in.

### MetricCard + Sparkline

```tsx
<MetricCard
  label="Impressions"
  value="12.4M"
  delta="+8.2%"
  trend="up"
  context="Last 7 days vs prior 7"
  series={[120, 145, 132, 158, 174, 162, 188]}
  tone="brand"
  icon={<Eye />}
  onClick={() => navigate('/reporting/impressions')}
/>
```

`tone`: `'brand' | 'success' | 'warning' | 'critical' | 'info' | 'neutral'`

### EmptyState

```tsx
<EmptyState
  icon={<Inbox />}
  kicker="No data"
  title="No campaigns yet"
  description="Create your first campaign to start trafficking creatives."
  action={<Button variant="primary" leadingIcon={<Plus />}>New campaign</Button>}
/>
```

### Skeleton + Spinner

```tsx
<Skeleton className="h-10 w-full rounded-lg" />
<MetricCardSkeleton />
<TableRowSkeleton columns={6} />

<Spinner size="md" />
<CenteredSpinner label="Loading workspace…" />
```

---

## DataTable

```tsx
const columns: ColumnDef<Campaign>[] = [
  {
    id: 'name',
    header: 'Name',
    cell: (row) => <strong>{row.name}</strong>,
    sortAccessor: (row) => row.name,
  },
  {
    id: 'impressions',
    header: 'Impressions',
    align: 'right',
    numeric: true,
    cell: (row) => row.impressions.toLocaleString(),
    sortAccessor: (row) => row.impressions,
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <Badge tone={toneFor(row.status)}>{row.status}</Badge>,
    sortAccessor: (row) => row.status,
  },
];

<DataTable
  columns={columns}
  data={campaigns}
  rowKey={(c) => c.id}
  density="comfortable"
  loading={isLoading}
  selectable
  selectedKeys={selected}
  onSelectionChange={setSelected}
  onRowClick={(c) => navigate(`/campaigns/${c.id}`)}
  renderBulkActions={(rows) => (
    <>
      <Button size="sm" variant="secondary">Pause {rows.length}</Button>
      <Button size="sm" variant="danger">Archive</Button>
    </>
  )}
/>
```

Density: `'compact' | 'comfortable' | 'spacious'` (default `'comfortable'`).

---

## Toast

```tsx
const { toast } = useToast();

toast({ tone: 'success',  title: 'Campaign updated' });
toast({ tone: 'critical', title: 'Save failed', description: error.message });
toast({
  tone: 'info',
  title: 'Pacing alert',
  description: 'Q4 Brand is 18% behind goal.',
  action: { label: 'View', onClick: () => navigate('/pacing/q4-brand') },
  duration: 0, // persistent
});
```

Mount once at root: `<ToastProvider>` — already done in `App.tsx`.

## Confirm

```tsx
const confirm = useConfirm();

const ok = await confirm({
  title: 'Pause this campaign?',
  description: 'Live tags will stop returning ads within 90s.',
});
if (!ok) return;
```

Destructive variant with type-to-confirm:

```tsx
const ok = await confirm({
  title: 'Delete campaign?',
  description: 'All associated tags and creatives will be deleted. This cannot be undone.',
  tone: 'danger',
  requireTypeToConfirm: campaign.name,
});
```

Mount once at root: `<ConfirmProvider>` — already done in `App.tsx`.

---

## Icons

```tsx
import { Plus, Settings, Megaphone } from '@/system/icons';
// ✗ never: import { Plus } from 'lucide-react';
```

The set is curated. If you need a new icon, add it to `system/icons/index.ts`.

Default size: 16px (h-4 w-4). Use `className` to override:

```tsx
<Plus className="h-5 w-5" />
```

---

## Don'ts

- Don't import from `@/system/primitives/*` — use the barrel.
- Don't use `bg-indigo-*`, `bg-green-600`, `bg-red-600` — they violate the system.
- Don't use emojis as functional icons.
- Don't write `dark:` overrides; tokens handle dark mode.
- Don't `window.confirm()` — use `useConfirm()`.
- Don't `console.log` user-facing errors — use `useToast({ tone: 'critical' })`.
- Don't write `<button className="bg-[linear-gradient(135deg,#F1008B,…)]">` — use `<Button variant="primary">`.

The ESLint rules enforce all of the above.
