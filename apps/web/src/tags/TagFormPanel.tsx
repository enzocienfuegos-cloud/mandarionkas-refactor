import React, { FormEvent } from 'react';
import { Badge, Button, FormField, Input, Panel, ReadOnlyValue, Select } from '../system';

interface Campaign {
  id: string;
  name: string;
  metadata?: { dsp?: string | null; mediaType?: string | null } | null;
}

type TagFormat = 'VAST' | 'display' | 'native' | 'tracker';
type TagStatus = 'draft' | 'active' | 'paused' | 'archived';
type TrackerType = 'click' | 'impression';

interface TagForm {
  name: string;
  campaignId: string;
  format: TagFormat;
  status: TagStatus;
  clickUrl: string;
  servingWidth: string;
  servingHeight: string;
  trackerType: TrackerType;
}

const DISPLAY_SIZE_PRESETS = [
  { label: '300x250', width: 300, height: 250 },
  { label: '320x50', width: 320, height: 50 },
  { label: '320x100', width: 320, height: 100 },
  { label: '336x280', width: 336, height: 280 },
  { label: '728x90', width: 728, height: 90 },
  { label: '970x250', width: 970, height: 250 },
  { label: '160x600', width: 160, height: 600 },
  { label: '300x600', width: 300, height: 600 },
];

const STATUSES: TagStatus[] = ['draft', 'active', 'paused', 'archived'];

function getDisplaySizePreset(width?: string, height?: string): string {
  const normalized = `${Number(width) || 0}x${Number(height) || 0}`;
  return DISPLAY_SIZE_PRESETS.some((preset) => preset.label === normalized) ? normalized : '';
}

interface TagFormPanelProps {
  isEdit: boolean;
  form: TagForm;
  campaigns: Campaign[];
  errors: Partial<Record<keyof TagForm, string>>;
  saving: boolean;
  successMessage: string;
  generalError: string;
  selectedCampaignMacroLabel?: string | null;
  videoCampaign: boolean;
  onSet: (field: keyof TagForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSetFormat: (format: TagFormat) => void;
  onDisplaySizePresetChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

export default function TagFormPanel({
  isEdit,
  form,
  campaigns,
  errors,
  saving,
  successMessage,
  generalError,
  selectedCampaignMacroLabel,
  videoCampaign,
  onSet,
  onSetFormat,
  onDisplaySizePresetChange,
  onSubmit,
  onCancel,
}: TagFormPanelProps) {
  return (
    <Panel className="mb-6 p-6">
      {generalError && (
        <Panel className="mb-4 border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-critical-fg)]" role="alert">
          {generalError}
        </Panel>
      )}
      {successMessage && (
        <Panel className="mb-4 border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-success-fg)]" role="status">
          {successMessage}
        </Panel>
      )}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormField label="Tag Name" required error={errors.name}>
          <Input
            type="text"
            value={form.name}
            onChange={onSet('name')}
            invalid={Boolean(errors.name)}
            placeholder="Homepage Leaderboard VAST"
          />
        </FormField>

        <FormField label="Campaign">
          <Select value={form.campaignId} onChange={onSet('campaignId')}>
            <option value="">— No campaign —</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </FormField>

        {selectedCampaignMacroLabel && (
          <Panel className="border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] px-4 py-3 text-xs text-[color:var(--dusk-status-info-fg)]">
            {selectedCampaignMacroLabel} selected on this campaign. Generated tag URLs will auto-inject configured DSP macros like <code>{'{pageUrlEnc}'}</code>, <code>{'{domain}'}</code>, click macro passthrough, privacy strings, and identity hints where applicable.
          </Panel>
        )}

        {videoCampaign && (
          <Panel className="border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] px-4 py-3 text-xs text-[color:var(--dusk-status-info-fg)]">
            This campaign is marked as <strong>Video</strong>. Tag creation is limited to <code>VAST</code>; <code>display</code>, <code>native</code>, and <code>tracker</code> are hidden on purpose.
          </Panel>
        )}

        <FormField label="Format">
          <div className="flex gap-3">
            {(videoCampaign ? (['VAST'] as TagFormat[]) : (['VAST', 'display', 'native', 'tracker'] as TagFormat[])).map(f => (
              <Button
                key={f}
                type="button"
                onClick={() => onSetFormat(f)}
                variant="secondary"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
                  form.format === f
                    ? 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]'
                    : 'border-[color:var(--dusk-border-default)] bg-surface-1 text-[color:var(--dusk-text-secondary)] hover:border-[color:var(--dusk-border-strong)] hover:bg-[color:var(--dusk-surface-muted)] hover:text-[color:var(--dusk-text-primary)]'
                }`}
                disabled={isEdit}
                aria-pressed={form.format === f}
              >
                <Badge tone={form.format === f ? 'info' : 'neutral'} size="sm">{f}</Badge>
                <span className="text-sm font-medium capitalize">{f}</span>
              </Button>
            ))}
          </div>
          {isEdit && (
            <p className="mt-2 text-xs text-[color:var(--dusk-text-secondary)]">
              Format is locked after a tag is created. Display tags remain display, and VAST tags remain VAST.
            </p>
          )}
        </FormField>

        {form.format === 'display' && (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Display Size Preset"
              required
              error={errors.servingWidth ?? errors.servingHeight}
              className="md:col-span-2"
            >
              <Select
                value={getDisplaySizePreset(form.servingWidth, form.servingHeight)}
                onChange={event => onDisplaySizePresetChange(event.target.value)}
                invalid={Boolean(errors.servingWidth || errors.servingHeight)}
              >
                <option value="">Select a size</option>
                {DISPLAY_SIZE_PRESETS.map((preset) => (
                  <option key={preset.label} value={preset.label}>
                    {preset.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Width">
              <ReadOnlyValue value={form.servingWidth} placeholder="300" copyable={false} />
            </FormField>
            <FormField label="Height">
              <ReadOnlyValue value={form.servingHeight} placeholder="250" copyable={false} />
            </FormField>
          </div>
        )}

        {form.format === 'tracker' && (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Tracker Type">
              <Select value={form.trackerType} onChange={onSet('trackerType')}>
                <option value="click">Click tracker</option>
                <option value="impression">Impression tracker</option>
              </Select>
            </FormField>
            <FormField label="Tracker Size">
              <ReadOnlyValue value={form.trackerType === 'impression' ? '1x1' : 'N/A'} copyable={false} />
            </FormField>
          </div>
        )}

        <FormField label="Status">
          <Select value={form.status} onChange={onSet('status')}>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </Select>
        </FormField>

        {form.format === 'tracker' ? (
          <details className="rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-4 py-3" open>
            <summary className="cursor-pointer text-sm font-medium text-[color:var(--dusk-text-primary)]">
              Tracker Destination
            </summary>
            <p className="mt-2 text-xs text-[color:var(--dusk-text-secondary)]">
              Click trackers need a destination URL. Impression trackers ignore this field and only return a 1x1 measurement pixel.
            </p>
            {form.trackerType === 'click' && (
              <FormField label="Destination URL" error={errors.clickUrl} className="mt-3">
                <Input
                  type="url"
                  value={form.clickUrl}
                  onChange={onSet('clickUrl')}
                  invalid={Boolean(errors.clickUrl)}
                  placeholder="https://example.com/landing"
                />
              </FormField>
            )}
          </details>
        ) : (
          <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-4 py-3 text-xs text-[color:var(--dusk-text-secondary)]">
            Destination URL is defined by the assigned creative. Tags do not override click destinations for display, native, or VAST delivery.
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--dusk-border-subtle)] pt-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Update Tag' : 'Create Tag'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
