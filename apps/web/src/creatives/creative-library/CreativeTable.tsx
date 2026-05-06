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
    <div className="app-scrollbar mt-6 overflow-auto rounded-3xl border border-slate-200 dark:border-white/8">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/8">
        <caption className="sr-only">Creative QA queue with selection, preview status, QA state and row actions.</caption>
        <thead className="bg-slate-50/80 dark:bg-white/[0.02]">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">
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
                className="h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
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
        <tbody className="divide-y divide-slate-200 dark:divide-white/8">
          {creatives.map((creative) => {
            const version = latestVersions[creative.id];
            const row = creativeRows.find((entry) => entry.id === creative.id);
            const previewHref = resolveCreativePreviewHref(creative, version);
            const previewKind = resolveCreativePreviewKind(creative, version);
            const needsAttention: PrioritySeverity = row?.qa ?? 'Notice';

            return (
              <tr key={creative.id} className="bg-white/42 align-top transition hover:bg-fuchsia-50/45 dark:bg-transparent dark:hover:bg-white/[0.04]">
                <td className="px-5 py-5">
                  <input
                    type="checkbox"
                    checked={selectedCreativeIds.includes(creative.id)}
                    onChange={() => onToggleCreativeSelection(creative.id)}
                    className="h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
                    aria-label={`Select creative ${creative.name}`}
                  />
                </td>
                <th scope="row" className="px-5 py-5 text-left">
                  <p className="font-semibold text-slate-950 dark:text-white">{row?.creative ?? creative.name}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-white/48">{row?.advertiser ?? creative.workspaceName ?? '—'} · {row?.campaign ?? 'No campaign'}</p>
                </th>
                <td className="px-5 py-5">
                  <CreativeStatusBadge status={row?.status ?? 'Missing'} />
                </td>
                <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row?.format ?? 'Display'}</td>
                <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row?.size ?? '—'}</td>
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
                <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row?.owner ?? 'Creative Ops'}</td>
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
                        className="border border-transparent text-slate-400 transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-600 dark:text-white/36 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
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
