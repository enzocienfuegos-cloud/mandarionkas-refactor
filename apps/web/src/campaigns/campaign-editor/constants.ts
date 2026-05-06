import { listSupportedDsps } from '@smx/contracts/dsp-macros';
import type { CampaignForm } from './types';

export const DSP_OPTIONS = [
  { value: '', label: '— None —' },
  ...listSupportedDsps().map((dsp) => ({ value: dsp.label, label: dsp.label })),
];

export const STATUSES = ['draft', 'active', 'paused', 'archived'];

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
};

export const campaignSelectClassName = 'w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2.5 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] hover:border-[color:var(--dusk-border-strong)] focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500';

export const invalidCampaignSelectClassName = `${campaignSelectClassName} border-[color:var(--dusk-status-critical-fg)] bg-rose-50/70 dark:bg-rose-500/10`;
