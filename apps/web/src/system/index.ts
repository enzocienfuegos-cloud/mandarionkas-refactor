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
export { Drawer } from './primitives/Drawer';
export type { DrawerProps } from './primitives/Drawer';
export { Popover } from './primitives/Popover';
export type { PopoverProps } from './primitives/Popover';
export { Tooltip } from './primitives/Tooltip';
export type { TooltipProps } from './primitives/Tooltip';
export { Avatar } from './primitives/Avatar';
export type { AvatarProps } from './primitives/Avatar';
export { ProgressBar } from './primitives/ProgressBar';
export type { ProgressBarProps } from './primitives/ProgressBar';
export { DropdownMenu } from './primitives/DropdownMenu';
export type {
  DropdownMenuProps,
  DropdownMenuEntry,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './primitives/DropdownMenu';

export { Skeleton, MetricCardSkeleton, TableRowSkeleton } from './primitives/Skeleton';

export { Spinner, CenteredSpinner } from './primitives/Spinner';
export type { SpinnerProps } from './primitives/Spinner';

export { EmptyState } from './primitives/EmptyState';
export type { EmptyStateProps } from './primitives/EmptyState';

export { MetricCard, Sparkline } from './primitives/MetricCard';
export type { MetricCardProps, MetricTrend, MetricTone } from './primitives/MetricCard';
export { FilterBar } from './primitives/FilterBar';
export type { FilterBarProps, FilterPill } from './primitives/FilterBar';
export { ReadOnlyValue } from './primitives/ReadOnlyValue';
export type { ReadOnlyValueProps } from './primitives/ReadOnlyValue';
export { CreativeThumb } from './primitives/CreativeThumb';

export { PageHeader } from './primitives/PageHeader';
export type { PageHeaderProps } from './primitives/PageHeader';
export { Stepper } from './primitives/Stepper';
export type { StepperProps, Step, StepStatus } from './primitives/Stepper';

// ─── Metrics ──────────────────────────────────────────────────────────────
export { ConfigurableMetricStrip } from './metrics/ConfigurableMetricStrip';
export type { ConfigurableMetricStripProps } from './metrics/ConfigurableMetricStrip';
export { MetricPicker } from './metrics/MetricPicker';
export type { MetricPickerProps } from './metrics/MetricPicker';
export { useMetricSelection } from './metrics/useMetricSelection';
export type {
  MetricDefinition,
  MetricScope,
  MetricTrend as RegistryMetricTrend,
  ResolvedMetric,
  MetricIconKind,
} from './metrics/registry';

// ─── Data ─────────────────────────────────────────────────────────────────
export { DataTable } from './data-table/DataTable';
export { DensityToggle } from './data-table/DensityToggle';
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
export { DonutChart } from './charts/DonutChart';
export type { DonutChartProps, DonutSegment } from './charts/DonutChart';
export { FunnelChart } from './charts/FunnelChart';
export type { FunnelChartProps, FunnelStage } from './charts/FunnelChart';
export { Heatmap } from './charts/Heatmap';
export type { HeatmapProps, HeatmapCell } from './charts/Heatmap';

// ─── Icons (re-exported for convenience) ──────────────────────────────────
export * as Icons from './icons';
