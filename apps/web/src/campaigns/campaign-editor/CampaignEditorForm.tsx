import React from 'react';
import type { WorkspaceOption } from '../../shared/workspaces';
import { Button, Combobox, DateRangePicker, FormField, Input, NumberInput, Select, type DateRange } from '../../system';
import { BUDGET_DELIVERY_MODES, DSP_OPTIONS, RATE_STRATEGIES, SERVING_COST_MODES, STATUSES } from './constants';
import type { CampaignForm } from './types';

type Props = {
  isEdit: boolean;
  form: CampaignForm;
  errors: Partial<CampaignForm>;
  workspaces: WorkspaceOption[];
  saving: boolean;
  onFieldChange: (field: keyof CampaignForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onValueChange: (field: keyof CampaignForm) => (value: string | string[]) => void;
  onNumberFieldChange: (field: 'impressionGoal' | 'dailyBudget' | 'lifetimeBudget' | 'estimatedRate' | 'markupPercent' | 'servingFeeCpm') => (value: number | null) => void;
  onDateRangeChange: (range: DateRange) => void;
  onCancel: () => void;
};

function parseDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function CampaignEditorForm({
  isEdit,
  form,
  errors,
  workspaces,
  saving,
  onFieldChange,
  onValueChange,
  onNumberFieldChange,
  onDateRangeChange,
  onCancel,
}: Props) {
  const workspaceOptions = workspaces.map((workspace) => ({
    value: workspace.id,
    label: workspace.name,
    description: workspace.slug ? `/${workspace.slug}` : undefined,
  }));
  const dspOptions = DSP_OPTIONS
    .filter((option) => option.value)
    .map((option) => ({ value: option.value, label: option.label }));
  const scheduleRange = {
    from: parseDate(form.startDate),
    to: parseDate(form.endDate),
  };

  return (
    <div className="space-y-5">
      <FormField label="Client" required error={errors.workspaceId}>
        <Combobox
          value={form.workspaceId}
          onChange={onValueChange('workspaceId')}
          options={workspaceOptions}
          invalid={Boolean(errors.workspaceId)}
          placeholder="Select a client"
          disabled={isEdit}
        />
      </FormField>

      <FormField label="Campaign Name" required error={errors.name}>
        <Input
          type="text"
          value={form.name}
          onChange={onFieldChange('name')}
          invalid={Boolean(errors.name)}
          placeholder="Q4 Brand Awareness"
        />
      </FormField>

      <FormField label="DSP">
        <Combobox
          value={form.dsp}
          onChange={onValueChange('dsp')}
          options={dspOptions}
          placeholder="Select a DSP"
        />
      </FormField>

      <FormField label="Media Type">
        <Select value={form.mediaType} onChange={onFieldChange('mediaType')}>
          <option value="display">Display / Interactive</option>
          <option value="video">Video</option>
        </Select>
      </FormField>

      <FormField label="Status">
        <Select value={form.status} onChange={onFieldChange('status')}>
          {STATUSES.map((status) => (
            <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="Flight Dates"
        helper="Pick the campaign start and end window from one shared range control."
        error={errors.endDate}
      >
        <DateRangePicker value={scheduleRange} onChange={onDateRangeChange} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Impression Goal" error={errors.impressionGoal}>
          <NumberInput
            value={form.impressionGoal ? Number(form.impressionGoal) : null}
            onChange={onNumberFieldChange('impressionGoal')}
            format="integer"
            min={0}
            invalid={Boolean(errors.impressionGoal)}
            placeholder="1000000"
          />
        </FormField>
        <FormField label="Daily Budget ($)" error={errors.dailyBudget}>
          <NumberInput
            value={form.dailyBudget ? Number(form.dailyBudget) : null}
            onChange={onNumberFieldChange('dailyBudget')}
            format="currency"
            currency="USD"
            min={0}
            step={0.01}
            invalid={Boolean(errors.dailyBudget)}
            placeholder="500.00"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Lifetime Budget ($)" error={errors.lifetimeBudget}>
          <NumberInput
            value={form.lifetimeBudget ? Number(form.lifetimeBudget) : null}
            onChange={onNumberFieldChange('lifetimeBudget')}
            format="currency"
            currency="USD"
            min={0}
            step={0.01}
            invalid={Boolean(errors.lifetimeBudget)}
            placeholder="15000.00"
          />
        </FormField>
        <FormField label="Budget Mode">
          <Select value={form.budgetDeliveryMode} onChange={onFieldChange('budgetDeliveryMode')}>
            {BUDGET_DELIVERY_MODES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FormField label="Estimated Rate (CPM)" error={errors.estimatedRate}>
          <NumberInput
            value={form.estimatedRate ? Number(form.estimatedRate) : null}
            onChange={onNumberFieldChange('estimatedRate')}
            format="currency"
            currency="USD"
            min={0}
            step={0.01}
            invalid={Boolean(errors.estimatedRate)}
            placeholder="2.50"
          />
        </FormField>
        <FormField label="Markup / Margin (%)" error={errors.markupPercent}>
          <NumberInput
            value={form.markupPercent ? Number(form.markupPercent) : null}
            onChange={onNumberFieldChange('markupPercent')}
            min={0}
            step={0.01}
            invalid={Boolean(errors.markupPercent)}
            placeholder="15"
          />
        </FormField>
        <FormField label="Serving Fee CPM" error={errors.servingFeeCpm}>
          <NumberInput
            value={form.servingFeeCpm ? Number(form.servingFeeCpm) : null}
            onChange={onNumberFieldChange('servingFeeCpm')}
            format="currency"
            currency="USD"
            min={0}
            step={0.0001}
            invalid={Boolean(errors.servingFeeCpm)}
            placeholder="0.10"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Rate Strategy">
          <Select value={form.rateStrategy} onChange={onFieldChange('rateStrategy')}>
            {RATE_STRATEGIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Serving Cost">
          <Select value={form.servingCostMode} onChange={onFieldChange('servingCostMode')}>
            {SERVING_COST_MODES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border-default pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {isEdit ? 'Update Campaign' : 'Create Campaign'}
        </Button>
      </div>
    </div>
  );
}
