import React from 'react';
import { Badge, Button, Input, Modal, Panel } from '../../system';
import type { VariantState } from './types';

type Preset = { label: string; width: number; height: number };

type Props = {
  variantState: VariantState;
  presets: Preset[];
  onClose: () => void;
  onFormChange: (field: 'label' | 'width' | 'height', value: string) => void;
  onAddVariant: () => void | Promise<void>;
  onAddPresets: (presets: Preset[]) => void | Promise<void>;
  onSelectAll: () => void;
  onToggleVariant: (variantId: string) => void;
  onBulkStatusChange: (status: 'active' | 'paused') => void | Promise<void>;
  onVariantStatusChange: (variantId: string, status: 'active' | 'paused') => void | Promise<void>;
  readinessBadge: (variant: VariantState['variants'][number]) => React.ReactNode;
  statusBadge: (status?: string) => React.ReactNode;
};

export function VariantManagerModal({
  variantState,
  presets,
  onClose,
  onFormChange,
  onAddVariant,
  onAddPresets,
  onSelectAll,
  onToggleVariant,
  onBulkStatusChange,
  onVariantStatusChange,
  readinessBadge,
  statusBadge,
}: Props) {
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Resolution management"
      description={variantState.creativeName}
      showCloseButton
    >
      <div className="space-y-4">
        <Panel className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Preset sizes</h3>
              <p className="mt-1 text-xs text-slate-500">Seed the matrix with common display resolutions in one action.</p>
            </div>
            <Button
              onClick={() => void onAddPresets(presets)}
              disabled={variantState.loading}
              variant="secondary"
              size="sm"
            >
              Add standard set
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                onClick={() => void onAddPresets([preset])}
                disabled={variantState.loading}
                variant="ghost"
                size="sm"
                className="rounded-full"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </Panel>

        <Panel className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_120px_120px_auto]">
          <Input
            value={variantState.form.label}
            onChange={event => onFormChange('label', event.target.value)}
            placeholder="300x250 · Mobile"
            className="rounded-lg"
          />
          <Input
            value={variantState.form.width}
            onChange={event => onFormChange('width', event.target.value)}
            placeholder="Width"
            className="rounded-lg"
          />
          <Input
            value={variantState.form.height}
            onChange={event => onFormChange('height', event.target.value)}
            placeholder="Height"
            className="rounded-lg"
          />
          <Button
            onClick={() => void onAddVariant()}
            loading={variantState.loading}
          >
            Add size
          </Button>
        </Panel>

        {variantState.error && (
          <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-critical-fg)]">
            {variantState.error}
          </Panel>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default bg-surface-2 px-4 py-3">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-text-secondary">
                <input
                  type="checkbox"
                  checked={variantState.variants.length > 0 && variantState.selectedVariantIds.length === variantState.variants.length}
                  onChange={onSelectAll}
                  className="rounded border-border-strong text-brand-500 focus:ring-brand-500"
                />
                Select all
              </label>
              <Badge tone="neutral" size="sm">{variantState.selectedVariantIds.length} selected</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void onBulkStatusChange('active')}
                disabled={variantState.loading || variantState.selectedVariantIds.length === 0}
                variant="secondary"
                size="sm"
                aria-label="Activate selected size variants"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              >
                Activate selected
              </Button>
              <Button
                onClick={() => void onBulkStatusChange('paused')}
                disabled={variantState.loading || variantState.selectedVariantIds.length === 0}
                variant="secondary"
                size="sm"
                aria-label="Pause selected size variants"
                className="border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-60"
              >
                Pause selected
              </Button>
            </div>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <caption className="sr-only">Resolution variants for the selected creative version.</caption>
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Select</span>
                </th>
                <th scope="col" className="px-4 py-3">Variant</th>
                <th scope="col" className="px-4 py-3">Size</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Readiness</th>
                <th scope="col" className="px-4 py-3">Bindings</th>
                <th scope="col" className="px-4 py-3">Preview</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {variantState.variants.map((variant) => (
                <tr key={variant.id}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={variantState.selectedVariantIds.includes(variant.id)}
                      onChange={() => onToggleVariant(variant.id)}
                      className="rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
                    />
                  </td>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-slate-800">{variant.label}</th>
                  <td className="px-4 py-3 text-slate-600">{variant.width}×{variant.height}</td>
                  <td className="px-4 py-3">{statusBadge(variant.status)}</td>
                  <td className="px-4 py-3">{readinessBadge(variant)}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-600">
                      <div>{variant.activeBindingCount ?? 0} active / {variant.bindingCount ?? 0} total</div>
                      {variant.tagNames && variant.tagNames.length > 0 && (
                        <div className="mt-1 truncate text-slate-500" title={variant.tagNames.join(', ')}>
                          {variant.tagNames.slice(0, 3).join(', ')}
                          {variant.tagNames.length > 3 ? ` +${variant.tagNames.length - 3}` : ''}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1 text-xs">
                      {variant.publicUrl ? (
                        <a href={variant.publicUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-300 dark:hover:text-fuchsia-200">
                          Open
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      <div className="text-slate-500">
                        {variant.totalImpressions ?? 0} imps / {variant.totalClicks ?? 0} clicks
                      </div>
                      <div className="text-slate-500">
                        CTR {(variant.ctr ?? 0).toFixed(2)}% · 7d {(variant.impressions7d ?? 0)} imps
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {variant.status === 'active' ? (
                      <Button
                        onClick={() => void onVariantStatusChange(variant.id, 'paused')}
                        disabled={variantState.loading}
                        variant="secondary"
                        size="sm"
                      >
                        Pause
                      </Button>
                    ) : (
                      <Button
                        onClick={() => void onVariantStatusChange(variant.id, 'active')}
                        disabled={variantState.loading}
                        variant="secondary"
                        size="sm"
                      >
                        Activate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!variantState.loading && variantState.variants.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                    No size variants yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
