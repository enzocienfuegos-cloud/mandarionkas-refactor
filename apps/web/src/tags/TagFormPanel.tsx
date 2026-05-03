import React, { FormEvent } from 'react';

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

function inputClass(err?: string) {
  return `w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
    err ? 'border-red-400 bg-red-50' : 'border-slate-300'
  }`;
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
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
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
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tag Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={onSet('name')}
            className={inputClass(errors.name)}
            placeholder="Homepage Leaderboard VAST"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Campaign</label>
          <select value={form.campaignId} onChange={onSet('campaignId')} className={inputClass()}>
            <option value="">— No campaign —</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {selectedCampaignMacroLabel && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
            {selectedCampaignMacroLabel} selected on this campaign. Generated tag URLs will auto-inject configured DSP macros like <code>{'{pageUrlEnc}'}</code>, <code>{'{domain}'}</code>, click macro passthrough, privacy strings, and identity hints where applicable.
          </div>
        )}

        {videoCampaign && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700">
            This campaign is marked as <strong>Video</strong>. Tag creation is limited to <code>VAST</code>; <code>display</code>, <code>native</code>, and <code>tracker</code> are hidden on purpose.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
          <div className="flex gap-3">
            {(videoCampaign ? (['VAST'] as TagFormat[]) : (['VAST', 'display', 'native', 'tracker'] as TagFormat[])).map(f => (
              <label
                key={f}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  form.format === f
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
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
            <p className="mt-2 text-xs text-slate-500">
              Format is locked after a tag is created. Display tags remain display, and VAST tags remain VAST.
            </p>
          )}
        </div>

        {form.format === 'display' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Display Size Preset <span className="text-red-500">*</span>
              </label>
              <select
                value={getDisplaySizePreset(form.servingWidth, form.servingHeight)}
                onChange={event => onDisplaySizePresetChange(event.target.value)}
                className={inputClass(errors.servingWidth || errors.servingHeight)}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Width</label>
              <input
                type="number"
                min="1"
                readOnly
                value={form.servingWidth}
                className={`${inputClass()} bg-slate-50 text-slate-500`}
                placeholder="300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Height</label>
              <input
                type="number"
                min="1"
                readOnly
                value={form.servingHeight}
                className={`${inputClass()} bg-slate-50 text-slate-500`}
                placeholder="250"
              />
            </div>
          </div>
        )}

        {form.format === 'tracker' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tracker Type</label>
              <select value={form.trackerType} onChange={onSet('trackerType')} className={inputClass()}>
                <option value="click">Click tracker</option>
                <option value="impression">Impression tracker</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tracker Size</label>
              <input
                type="text"
                readOnly
                value={form.trackerType === 'impression' ? '1x1' : 'N/A'}
                className={`${inputClass()} bg-slate-50 text-slate-500`}
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select value={form.status} onChange={onSet('status')} className={inputClass()}>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {form.format === 'tracker' ? (
          <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" open>
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Tracker Destination
            </summary>
            <p className="mt-2 text-xs text-slate-500">
              Click trackers need a destination URL. Impression trackers ignore this field and only return a 1x1 measurement pixel.
            </p>
            {form.trackerType === 'click' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Destination URL
                </label>
                <input
                  type="url"
                  value={form.clickUrl}
                  onChange={onSet('clickUrl')}
                  className={inputClass(errors.clickUrl)}
                  placeholder="https://example.com/landing"
                />
                {errors.clickUrl && <p className="mt-1 text-xs text-red-600">{errors.clickUrl}</p>}
              </div>
            )}
          </details>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Destination URL is defined by the assigned creative. Tags do not override click destinations for display, native, or VAST delivery.
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg transition-colors flex items-center gap-2"
          >
            {saving && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
            {saving ? 'Saving...' : isEdit ? 'Update Tag' : 'Create Tag'}
          </button>
        </div>
      </form>
    </div>
  );
}
