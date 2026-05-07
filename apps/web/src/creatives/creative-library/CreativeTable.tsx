import React from 'react';
import { CreativeThumb, DataTable, IconButton, type ColumnDef } from '../../system';
import type { Creative, CreativeVersion } from '../catalog';
import type { CreativeRow, PreviewModalState } from './types';
import { CreativePreviewCell } from './CreativePreviewCell';
import { CreativeRowActions } from './CreativeRowActions';
import { CreativeStatusBadge, MoreIcon, OperationalSignalBadge, resolveCreativePreviewHref, resolveCreativePreviewKind } from './ui';

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
  getCreativeOperationalState: (creative: Creative) => 'live' | 'publishing' | 'inactive' | 'attention';
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
  const selectedKeySet = React.useMemo(() => new Set(selectedCreativeIds), [selectedCreativeIds]);

  const columns = React.useMemo<ColumnDef<CreativeRow>[]>(() => [
    {
      id: 'thumb',
      header: 'Asset',
      pinned: true,
      width: '88px',
      cell: (row) => {
        const creative = creatives.find((entry) => entry.id === row.id);
        const version = latestVersions[row.id];
        const previewHref = creative ? (resolveCreativePreviewHref(creative, version) ?? '') : '';
        return (
          <CreativeThumb
            creativeId={row.id}
            width={version?.width}
            height={version?.height}
            weightKb={version?.fileSize ? version.fileSize / 1024 : null}
            format={row.format}
            previewUrl={previewHref}
            staticImageUrl={creative?.thumbnailUrl}
          />
        );
      },
    },
    {
      id: 'creative',
      header: 'Creative',
      cell: (row) => (
        <div>
          <p className="font-semibold text-text-primary">{row.creative}</p>
          <p className="mt-1 text-xs text-text-muted">{row.advertiser} · {row.campaign}</p>
        </div>
      ),
      sortAccessor: (row) => row.creative,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <CreativeStatusBadge status={row.status} />,
      sortAccessor: (row) => row.status,
    },
    {
      id: 'format',
      header: 'Format',
      cell: (row) => row.format,
      sortAccessor: (row) => row.format,
    },
    {
      id: 'size',
      header: 'Size',
      cell: (row) => row.size,
      sortAccessor: (row) => row.size,
    },
    {
      id: 'preview',
      header: 'Preview',
      cell: (row) => {
        const creative = creatives.find((entry) => entry.id === row.id);
        const version = latestVersions[row.id];
        const previewHref = creative ? (resolveCreativePreviewHref(creative, version) ?? '') : '';
        const previewKind = creative ? (resolveCreativePreviewKind(creative, version) ?? 'html') : 'html';
        return creative ? (
          <CreativePreviewCell
            creativeName={creative.name}
            previewHref={previewHref}
            previewKind={previewKind}
            previewLabel={row.preview}
            posterUrl={creative.thumbnailUrl}
            mimeType={version?.mimeType}
            fileSizeBytes={version?.fileSize}
            durationMs={version?.durationMs}
            sourceKind={version?.sourceKind}
            versionStatus={version?.status}
            versionSourceKind={version?.sourceKind}
            width={version?.width}
            height={version?.height}
            onOpenPreview={onOpenPreview}
          />
        ) : (
          <span className="text-text-soft">Asset missing</span>
        );
      },
      sortAccessor: (row) => row.preview,
    },
    {
      id: 'signal',
      header: 'Signal',
      cell: (row) => <OperationalSignalBadge signal={row.signal} />,
      sortAccessor: (row) => row.signal,
    },
    {
      id: 'owner',
      header: 'Owner',
      cell: (row) => row.owner,
      sortAccessor: (row) => row.owner,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => {
        const creative = creatives.find((entry) => entry.id === row.id);
        const version = latestVersions[row.id];
        if (!creative) return null;
        return version ? (
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
        );
      },
    },
  ], [
    creatives,
    getCreativeOperationalState,
    latestVersions,
    onAssignTag,
    onDeleteCreative,
    onEditClickUrl,
    onOpenDeliveryManager,
    onOpenPreview,
    onToggleOperationalStatus,
    statusUpdateCreativeId,
    workspaceBusy,
  ]);

  return (
    <div className="mt-6">
      <DataTable
        columns={columns}
        data={creativeRows}
        rowKey={(row) => row.id}
        selectable
        selectedKeys={selectedKeySet}
        onSelectionChange={(nextKeys) => {
          const currentKeys = new Set(selectedCreativeIds);
          creativeRows.forEach((row) => {
            const shouldSelect = nextKeys.has(row.id);
            const isSelected = currentKeys.has(row.id);
            if (shouldSelect !== isSelected) {
              onToggleCreativeSelection(row.id);
            }
          });
        }}
        bordered
      />
    </div>
  );
}
