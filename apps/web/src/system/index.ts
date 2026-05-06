/**
 * DUSK Design System — public API
 *
 * USAGE: Always import from this file, never reach into subfolders.
 *
 *   import { Button, Panel, Badge, useToast, useConfirm } from '@/system';
 *
 * The ESLint rule `no-deep-system-imports` enforces this.
 */

// ─── Utility ──────────────────────────────────────────────────────────────
export { cn } from './cn';

// ─── Primitives ───────────────────────────────────────────────────────────
export { Button, IconButton } from './primitives/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './primitives/Button';

export { Panel, PanelHeader } from './primitives/Panel';
export type { PanelProps, PanelElevation, PanelPadding } from './primitives/Panel';

export { Input, FormField } from './primitives/Input';
export type { InputProps, InputSize } from './primitives/Input';

export { Select } from './primitives/Select';
export type { SelectProps, SelectSize, SelectOption } from './primitives/Select';

export { Badge, Kicker } from './primitives/Badge';
export type { BadgeProps, BadgeTone, BadgeSize, BadgeVariant } from './primitives/Badge';

export { Tabs, TabsList, Tab, TabPanel } from './primitives/Tabs';
export type { TabsProps, TabProps, TabPanelProps } from './primitives/Tabs';

export { Modal } from './primitives/Modal';
export type { ModalProps } from './primitives/Modal';

export { Skeleton, MetricCardSkeleton, TableRowSkeleton } from './primitives/Skeleton';

export { Spinner, CenteredSpinner } from './primitives/Spinner';
export type { SpinnerProps } from './primitives/Spinner';

export { EmptyState } from './primitives/EmptyState';
export type { EmptyStateProps } from './primitives/EmptyState';

export { MetricCard, Sparkline } from './primitives/MetricCard';
export type { MetricCardProps, MetricTrend, MetricTone } from './primitives/MetricCard';

// ─── Data ─────────────────────────────────────────────────────────────────
export { DataTable } from './data-table/DataTable';
export type {
  DataTableProps,
  ColumnDef,
  Density,
  SortDirection,
} from './data-table/DataTable';

// ─── Feedback ─────────────────────────────────────────────────────────────
export { ToastProvider, useToast } from './feedback/Toast';
export type { ToastOptions, ToastTone } from './feedback/Toast';

export { ConfirmProvider, useConfirm } from './feedback/Confirm';
export type { ConfirmOptions } from './feedback/Confirm';

// ─── Command palette ──────────────────────────────────────────────────────
export {
  CommandPaletteProvider,
  useCommandPalette,
  useRegisterCommands,
} from './command-palette/CommandPalette';
export type { CommandItem, CommandPaletteContextValue } from './command-palette/CommandPalette';

// ─── Charts ───────────────────────────────────────────────────────────────
export { TrendChart } from './charts/TrendChart';
export type {
  TrendChartProps,
  TrendChartKind,
  TrendSeries,
  TrendTone,
} from './charts/TrendChart';

// ─── Icons (re-exported for convenience) ──────────────────────────────────
export * as Icons from './icons';
