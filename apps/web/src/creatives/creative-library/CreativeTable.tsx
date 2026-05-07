import React from 'react';
import { IconButton } from '../../system';
import type { Creative, CreativeVersion } from '../catalog';
import type { CreativeRow, PreviewModalState, PrioritySeverity } from './types';
import { CreativePreviewCell } from './CreativePreviewCell';
import { CreativeRowActions } from './CreativeRowActions';
import { CreativeStatusBadge, MoreIcon, PrioritySeverityBadge, resolveCreativePreviewHref, resolveCreativePreviewKind } from './ui';

type Props = {
  creatives: Creative[];
  latestVersions: Record<string, CreativeVersion | null>;
  creativeRows: CreativeRow[];
  selectedCreativeIds: string[];
  allVisibleCreativesSelected: boolean;
  someVisibleCreativesSelected: boolean;
  onToggleSelectAllVisible: () => void;
  onToggleCreativeSelection: (creativeId: string) => void;
  onOpenPreview: (preview: PreviewModalState) => void;
  statusUpdateCreativeId: string;
  workspaceBusy: boolean;
  getCreativeOperationalState: (creative: Creative) => 'active' | 'inactive' | 'pending_review' | 'rejected' | 'draft';
  onToggleOperationalStatus: (creative: Creative) => void | Promise<void>;
  onEditClickUrl: (creative: Creative) => void | Promise<void>;
  onOpenDeliveryManager: (creative: Creative, version: CreativeVersion) => void | Promise<void>;
  onAssignTag: (creative: Creative, version: CreativeVersion) => void | Promise<void>;
  onDeleteCreative: (creative: Creative) => void | Promise<void>;
};

export function CreativeTable({
  creatives,
  latestVersions,
  creativeRows,
  selectedCreativeIds,
  allVisibleCreativesSelected,
  someVisibleCreativesSelected,
  onToggleSelectAllVisible,
  onToggleCreativeSelection,
  onOpenPreview,
  statusUpdateCreativeId,
  workspaceBusy,
  getCreativeOperationalState,
  onToggleOperationalStatus,
  onEditClickUrl,
  onOpenDeliveryManager,
  onAssignTag,
  onDeleteCreative,
}: Props) {
  return (
    <div className="app-scrollbar mt-6 overflow-auto rounded-3xl border border-border-default">
      <table className="min-w-full divide-y divide-border-default text-sm">
        <caption className="sr-only">Creative QA queue with selection, preview status, QA state and row actions.</caption>
        <thead className="bg-surface-2/80">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-text-soft">
            <th scope="col" className="px-5 py-4">
              <input
                type="checkbox"
                checked={allVisibleCreativesSelected}
                ref={(element) => {
                  if (element) {
                    element.indeterminate = !allVisibleCreativesSelected && someVisibleCreativesSelected;
                  }
                }}
                onChange={onToggleSelectAllVisible}
                className="h-4 w-4 rounded border-border-strong text-brand-500 focus:ring-brand-500"
                aria-label="Select all visible creatives"
              />
            </th>
            <th scope="col" className="px-5 py-4">Creative</th>
            <th scope="col" className="px-5 py-4">Status</th>
            <th scope="col" className="px-5 py-4">Format</th>
            <th scope="col" className="px-5 py-4">Size</th>
            <th scope="col" className="px-5 py-4">Preview</th>
            <th scope="col" className="px-5 py-4">QA</th>
            <th scope="col" className="px-5 py-4">Owner</th>
            <th scope="col" className="px-5 py-4" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {creatives.map((creative) => {
            const version = latestVersions[creative.id];
            const row = creativeRows.find((entry) => entry.id === creative.id);
            const previewHref = resolveCreativePreviewHref(creative, version);
            const previewKind = resolveCreativePreviewKind(creative, version);
            const needsAttention: PrioritySeverity = row?.qa ?? 'Notice';

            return (
              <tr key={creative.id} className="bg-surface-1/40 align-top transition hover:bg-surface-2/70">
                <td className="px-5 py-5">
                  <input
                    type="checkbox"
                    checked={selectedCreativeIds.includes(creative.id)}
                    onChange={() => onToggleCreativeSelection(creative.id)}
                    className="h-4 w-4 rounded border-border-strong text-brand-500 focus:ring-brand-500"
                    aria-label={`Select creative ${creative.name}`}
                  />
                </td>
                <th scope="row" className="px-5 py-5 text-left">
                  <p className="font-semibold text-text-primary">{row?.creative ?? creative.name}</p>
                  <p className="mt-1 text-xs text-text-muted">{row?.advertiser ?? creative.workspaceName ?? '—'} · {row?.campaign ?? 'No campaign'}</p>
                </th>
                <td className="px-5 py-5">
                  <CreativeStatusBadge status={row?.status ?? 'Missing'} />
                </td>
                <td className="px-5 py-5 text-text-secondary">{row?.format ?? 'Display'}</td>
                <td className="px-5 py-5 text-text-secondary">{row?.size ?? '—'}</td>
                <td className="px-5 py-5">
                  <CreativePreviewCell
                    creativeName={creative.name}
                    previewHref={previewHref}
                    previewKind={previewKind}
                    previewLabel={row?.preview ?? 'Asset missing'}
                    versionStatus={version?.status}
                    versionSourceKind={version?.sourceKind}
                    width={version?.width}
                    height={version?.height}
                    onOpenPreview={onOpenPreview}
                  />
                </td>
                <td className="px-5 py-5">
                  <PrioritySeverityBadge severity={needsAttention} />
                </td>
                <td className="px-5 py-5 text-text-secondary">{row?.owner ?? 'Creative Ops'}</td>
                <td className="px-5 py-5">
                  {version ? (
                    <CreativeRowActions
                      creative={creative}
                      version={version}
                      statusUpdateCreativeId={statusUpdateCreativeId}
                      workspaceBusy={workspaceBusy}
                      getCreativeOperationalState={getCreativeOperationalState}
                      onToggleOperationalStatus={onToggleOperationalStatus}
                      onEditClickUrl={onEditClickUrl}
                      onOpenDeliveryManager={onOpenDeliveryManager}
                      onAssignTag={onAssignTag}
                      onDeleteCreative={onDeleteCreative}
                    />
                  ) : (
                    <div className="flex justify-end">
                      <IconButton
                        onClick={() => void onDeleteCreative(creative)}
                        className="border border-transparent text-text-soft transition hover:border-brand-500/20 hover:bg-brand-500/10 hover:text-text-brand"
                        aria-label={`Delete ${creative.name}`}
                        icon={<MoreIcon className="h-4 w-4" />}
                      />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
