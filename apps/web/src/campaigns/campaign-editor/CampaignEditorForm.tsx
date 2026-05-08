import React from 'react';
import type { WorkspaceOption } from '../../shared/workspaces';
import { Button, Combobox, DateRangePicker, FormField, Input, NumberInput, Select, type DateRange } from '../../system';
import { DSP_OPTIONS, STATUSES } from './constants';
import type { CampaignForm } from './types';

type Props = {
  isEdit: boolean;
  form: CampaignForm;
  errors: Partial<CampaignForm>;
  workspaces: WorkspaceOption[];
  saving: boolean;
  onFieldChange: (field: keyof CampaignForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onValueChange: (field: keyof CampaignForm) => (value: string | string[]) => void;
  onNumberFieldChange: (field: 'impressionGoal' | 'dailyBudget') => (value: number | null) => void;
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
      {!isEdit && (
        <FormField label="Client" required error={errors.workspaceId}>
          <Combobox
            value={form.workspaceId}
            onChange={onValueChange('workspaceId')}
            options={workspaceOptions}
            invalid={Boolean(errors.workspaceId)}
            placeholder="Select a client"
          />
        </FormField>
      )}

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

      <div className="grid grid-cols-2 gap-4">
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
