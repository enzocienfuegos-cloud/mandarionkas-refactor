import React from 'react';
import type { WorkspaceOption } from '../../shared/workspaces';
import { Button, FormField, Input } from '../../system';
import { campaignSelectClassName, DSP_OPTIONS, invalidCampaignSelectClassName, STATUSES } from './constants';
import type { CampaignForm } from './types';

type Props = {
  isEdit: boolean;
  form: CampaignForm;
  errors: Partial<CampaignForm>;
  workspaces: WorkspaceOption[];
  saving: boolean;
  onFieldChange: (field: keyof CampaignForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onCancel: () => void;
};

export function CampaignEditorForm({
  isEdit,
  form,
  errors,
  workspaces,
  saving,
  onFieldChange,
  onCancel,
}: Props) {
  return (
    <div className="space-y-5">
      {!isEdit && (
        <FormField label="Client" required error={errors.workspaceId}>
          <select
            value={form.workspaceId}
            onChange={onFieldChange('workspaceId')}
            className={errors.workspaceId ? invalidCampaignSelectClassName : campaignSelectClassName}
          >
            <option value="">Select a client</option>
            {workspaces.map(workspace => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
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
        <select value={form.dsp} onChange={onFieldChange('dsp')} className={campaignSelectClassName}>
          {DSP_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>{option.label}</option>
          ))}
        </select>
      </FormField>

      <FormField label="Media Type">
        <select value={form.mediaType} onChange={onFieldChange('mediaType')} className={campaignSelectClassName}>
          <option value="display">Display / Interactive</option>
          <option value="video">Video</option>
        </select>
      </FormField>

      <FormField label="Status">
        <select value={form.status} onChange={onFieldChange('status')} className={campaignSelectClassName}>
          {STATUSES.map(status => (
            <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Start Date">
          <Input type="date" value={form.startDate} onChange={onFieldChange('startDate')} />
        </FormField>
        <FormField label="End Date" error={errors.endDate}>
          <Input
            type="date"
            value={form.endDate}
            onChange={onFieldChange('endDate')}
            invalid={Boolean(errors.endDate)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Impression Goal" error={errors.impressionGoal}>
          <Input
            type="number"
            min="0"
            value={form.impressionGoal}
            onChange={onFieldChange('impressionGoal')}
            invalid={Boolean(errors.impressionGoal)}
            placeholder="1000000"
          />
        </FormField>
        <FormField label="Daily Budget ($)" error={errors.dailyBudget}>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.dailyBudget}
            onChange={onFieldChange('dailyBudget')}
            invalid={Boolean(errors.dailyBudget)}
            placeholder="500.00"
          />
        </FormField>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-2">
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
