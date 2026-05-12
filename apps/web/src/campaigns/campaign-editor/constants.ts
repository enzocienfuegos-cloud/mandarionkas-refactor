import { listSupportedDsps } from '@smx/contracts/dsp-macros';
import type { CampaignForm } from './types';

export const DSP_OPTIONS = [
  { value: '', label: '— None —' },
  ...listSupportedDsps().map((dsp) => ({ value: dsp.label, label: dsp.label })),
];

export const STATUSES = ['draft', 'active', 'paused', 'archived'];
export const BUDGET_DELIVERY_MODES = [
  { value: 'daily', label: 'Daily budget only' },
  { value: 'lifetime', label: 'Lifetime budget only' },
  { value: 'hybrid', label: 'Daily + lifetime' },
];

export const RATE_STRATEGIES = [
  { value: 'budget_only', label: 'Budget first' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'rate_priority', label: 'Rate priority' },
];

export const SERVING_COST_MODES = [
  { value: 'paid', label: 'Serving with cost' },
  { value: 'free', label: 'Serving without cost' },
];

export const emptyForm: CampaignForm = {
  workspaceId: '',
  name: '',
  dsp: '',
  mediaType: 'display',
  status: 'draft',
  startDate: '',
  endDate: '',
  impressionGoal: '',
  dailyBudget: '',
  lifetimeBudget: '',
  estimatedRate: '',
  markupPercent: '',
  servingFeeCpm: '',
  budgetDeliveryMode: 'hybrid',
  rateStrategy: 'budget_only',
  servingCostMode: 'paid',
};

export const campaignSelectClassName = 'w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2.5 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] hover:border-[color:var(--dusk-border-strong)] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500';

export const invalidCampaignSelectClassName = `${campaignSelectClassName} border-[color:var(--dusk-status-critical-fg)] bg-[color:var(--dusk-status-critical-bg)]`;
