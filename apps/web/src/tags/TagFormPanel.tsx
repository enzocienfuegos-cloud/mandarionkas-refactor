import React, { FormEvent } from 'react';
import { Button, Input } from '../system';

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
    <div className="mb-6 rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 p-6">
      {generalError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {generalError}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div>
          <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-primary)]">
            Tag Name <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            value={form.name}
            onChange={onSet('name')}
            className={errors.name ? 'border-[color:var(--dusk-status-critical-fg)] bg-rose-50/70 dark:bg-rose-500/10' : undefined}
            placeholder="Homepage Leaderboard VAST"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-primary)]">Campaign</label>
          <select value={form.campaignId} onChange={onSet('campaignId')} className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2.5 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] hover:border-[color:var(--dusk-border-strong)] focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500">
            <option value="">— No campaign —</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {selectedCampaignMacroLabel && (
          <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-4 py-3 text-xs text-fuchsia-700 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
            {selectedCampaignMacroLabel} selected on this campaign. Generated tag URLs will auto-inject configured DSP macros like <code>{'{pageUrlEnc}'}</code>, <code>{'{domain}'}</code>, click macro passthrough, privacy strings, and identity hints where applicable.
          </div>
        )}

        {videoCampaign && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300">
            This campaign is marked as <strong>Video</strong>. Tag creation is limited to <code>VAST</code>; <code>display</code>, <code>native</code>, and <code>tracker</code> are hidden on purpose.
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-[color:var(--dusk-text-primary)]">Format</label>
          <div className="flex gap-3">
            {(videoCampaign ? (['VAST'] as TagFormat[]) : (['VAST', 'display', 'native', 'tracker'] as TagFormat[])).map(f => (
              <label
                key={f}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  form.format === f
                    ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-300'
                    : 'border-[color:var(--dusk-border-default)] bg-surface-1 text-[color:var(--dusk-text-secondary)] hover:border-[color:var(--dusk-border-strong)] hover:bg-[color:var(--dusk-surface-muted)] hover:text-[color:var(--dusk-text-primary)]'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={f}
                  checked={form.format === f}
                  onChange={() => onSetFormat(f)}
                  disabled={isEdit}
                  className="sr-only"
                />
                <span className="text-sm font-medium capitalize">{f}</span>
              </label>
            ))}
          </div>
          {isEdit && (
            <p className="mt-2 text-xs text-[color:var(--dusk-text-secondary)]">
              Format is locked after a tag is created. Display tags remain display, and VAST tags remain VAST.
            </p>
          )}
        </div>

        {form.format === 'display' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-primary)]">
                Display Size Preset <span className="text-red-500">*</span>
              </label>
              <select
                value={getDisplaySizePreset(form.servingWidth, form.servingHeight)}
                onChange={event => onDisplaySizePresetChange(event.target.value)}
                className={`w-full rounded-lg border bg-surface-1 px-3 py-2.5 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] hover:border-[color:var(--dusk-border-strong)] focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 ${
                  errors.servingWidth || errors.servingHeight
                    ? 'border-[color:var(--dusk-status-critical-fg)] bg-rose-50/70 dark:bg-rose-500/10'
                    : 'border-[color:var(--dusk-border-default)]'
                }`}
              >
                <option value="">Select a size</option>
                {DISPLAY_SIZE_PRESETS.map((preset) => (
                  <option key={preset.label} value={preset.label}>
                    {preset.label}
                  </option>
                ))}
              </select>
              {(errors.servingWidth || errors.servingHeight) && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.servingWidth ?? errors.servingHeight}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-primary)]">Width</label>
              <Input
                type="number"
                min="1"
                readOnly
                value={form.servingWidth}
                className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-3 py-2.5 text-sm text-[color:var(--dusk-text-secondary)]"
                placeholder="300"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-primary)]">Height</label>
              <Input
                type="number"
                min="1"
                readOnly
                value={form.servingHeight}
                className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-3 py-2.5 text-sm text-[color:var(--dusk-text-secondary)]"
                placeholder="250"
              />
            </div>
          </div>
        )}

        {form.format === 'tracker' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-primary)]">Tracker Type</label>
              <select value={form.trackerType} onChange={onSet('trackerType')} className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2.5 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] hover:border-[color:var(--dusk-border-strong)] focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500">
                <option value="click">Click tracker</option>
                <option value="impression">Impression tracker</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-primary)]">Tracker Size</label>
              <Input
                type="text"
                readOnly
                value={form.trackerType === 'impression' ? '1x1' : 'N/A'}
                className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-3 py-2.5 text-sm text-[color:var(--dusk-text-secondary)]"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-primary)]">Status</label>
          <select value={form.status} onChange={onSet('status')} className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2.5 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] hover:border-[color:var(--dusk-border-strong)] focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500">
            {STATUSES.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {form.format === 'tracker' ? (
          <details className="rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-4 py-3" open>
            <summary className="cursor-pointer text-sm font-medium text-[color:var(--dusk-text-primary)]">
              Tracker Destination
            </summary>
            <p className="mt-2 text-xs text-[color:var(--dusk-text-secondary)]">
              Click trackers need a destination URL. Impression trackers ignore this field and only return a 1x1 measurement pixel.
            </p>
            {form.trackerType === 'click' && (
              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-primary)]">
                  Destination URL
                </label>
                <Input
                  type="url"
                  value={form.clickUrl}
                  onChange={onSet('clickUrl')}
                  className={errors.clickUrl ? 'border-[color:var(--dusk-status-critical-fg)] bg-rose-50/70 dark:bg-rose-500/10' : undefined}
                  placeholder="https://example.com/landing"
                />
                {errors.clickUrl && <p className="mt-1 text-xs text-red-600">{errors.clickUrl}</p>}
              </div>
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
    </div>
  );
}
