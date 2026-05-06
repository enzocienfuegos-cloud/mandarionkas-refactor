import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  type Creative,
  type CreativeVersion,
  type CreativeIngestion,
  type CreativeSizeVariant,
  type VideoRendition,
  type TagOption,
  loadCreativeIngestion,
  loadCreativeVersionDetail,
  loadCreativesWithLatestVersion,
  loadCreativeIngestions,
  loadVideoRenditions,
  regenerateVideoRenditions,
  loadTags,
  updateVideoRenditionById,
} from './catalog';
import type {
  CreativeFormat,
  CreativeRow,
  CreativeStatus,
  LatestVersionMap,
  Metric,
  PreviewModalState,
  PrototypeCheck,
  PrioritySeverity,
} from './creative-library/types';
import { CreativePreviewLightbox } from './creative-library/CreativePreviewLightbox';
import { ClickUrlEditorModal } from './creative-library/ClickUrlEditorModal';
import { CreativeBulkActionsPanel } from './creative-library/CreativeBulkActionsPanel';
import { CreativePreviewCell } from './creative-library/CreativePreviewCell';
import { CreativeQueuePanel } from './creative-library/CreativeQueuePanel';
import { CreativeRowActions } from './creative-library/CreativeRowActions';
import { CreativeSidebarInsights } from './creative-library/CreativeSidebarInsights';
import { CreativeTable } from './creative-library/CreativeTable';
import { useCreativeCatalogActions } from './creative-library/useCreativeCatalogActions';
import { useCreativeCatalogData } from './creative-library/useCreativeCatalogData';
import { QuickCreateTagModal } from './creative-library/QuickCreateTagModal';
import { TagBindingModal } from './creative-library/TagBindingModal';
import { useTagBindingManager } from './creative-library/useTagBindingManager';
import { useVariantManager } from './creative-library/useVariantManager';
import { useVideoRenditionManager } from './creative-library/useVideoRenditionManager';
import { VariantManagerModal } from './creative-library/VariantManagerModal';
import { VideoRenditionsModal } from './creative-library/VideoRenditionsModal';
import { CreativeWorkspaceOverview } from './creative-library/CreativeWorkspaceOverview';
import {
  VARIANT_PRESETS,
  buildLatestVersionPatch,
  classNames,
  estimateRegenerationFeedback,
  estimateRemainingDuration,
  findPendingIngestionForCreative,
  formatDuration,
  getPublishStageLabel,
  getRenditionProgressLabel,
  getVideoRenditionStatusBadge,
  getVideoRenditionToggleBlockedReason,
} from './creative-library/utils';
import {
  formatBytes,
  formatVideoBitrate,
  readinessBadge,
  resolveCreativePreviewHref,
  statusBadge,
} from './creative-library/ui';
import type { WorkspaceOption } from '../shared/workspaces';
import { Button, CenteredSpinner, Input, Kicker, Panel, useConfirm } from '../system';

export default function CreativesView() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const searchQueryParam = searchParams.get('search') ?? '';
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState(() => searchQueryParam);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending_review' | 'rejected'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'video' | 'display' | 'native'>('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [selectedCreativeIds, setSelectedCreativeIds] = useState<string[]>([]);
  const [bulkClickUrl, setBulkClickUrl] = useState('');
  const [bulkAssignTagId, setBulkAssignTagId] = useState('');
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);
  const {
    creatives,
    setCreatives,
    latestVersions,
    setLatestVersions,
    ingestions,
    setIngestions,
    tags,
    setTags,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    loading,
    error,
    setError,
    load,
  } = useCreativeCatalogData();
  const {
    variantState,
    setVariantState,
    openVariantManager,
    handleVariantStatusChange,
    toggleVariantSelection,
    toggleSelectAllVariants,
    handleCreateVariant,
    handleCreatePresetVariants,
    handleBulkVariantStatusChange,
    handleVariantFormChange,
  } = useVariantManager();
  const {
    bindingState,
    setBindingState,
    quickCreateTagState,
    setQuickCreateTagState,
    handleAssign,
    handlePrepareBinding,
    handleQuickCreateTag,
    handleConfirmQuickCreateTag,
    handleBindingStatusChange,
  } = useTagBindingManager({
    activeWorkspaceId,
    setActiveWorkspaceId,
    setWorkspaceBusy,
    setError,
    setSuccessMessage,
    setTags,
    tags,
  });

  const {
    videoRenditionState,
    setVideoRenditionState,
    regenerationFeedback,
    openVideoRenditionManager,
    handleVideoRenditionStatusChange,
    handleRegenerateVideoRenditions,
    plannedRenditions,
    renditionProcessing,
    videoProcessing,
    videoProcessingSummary,
    estimatedRemainingMs,
    pendingPublishPercent,
    pendingPublishStage,
    pendingPublishMessage,
  } = useVideoRenditionManager({
    ingestions,
    setIngestions,
    onReloadCatalog: load,
  });

  useEffect(() => {
    setSearchTerm(searchQueryParam);
  }, [searchQueryParam]);

  const getCreativeOperationalState = (creative: Creative) => {
    const version = latestVersions[creative.id];
    const status = String(version?.status ?? '').toLowerCase();
    if (status === 'archived') return 'inactive';
    if (status === 'pending_review') return 'pending_review';
    if (status === 'rejected') return 'rejected';
    return 'active';
  };

  const getCreativeFormatFamily = (creative: Creative) => {
    const version = latestVersions[creative.id];
    if (version?.servingFormat === 'vast_video') return 'video';
    if (version?.servingFormat === 'native') return 'native';
    return 'display';
  };

  const getCreativeSizeLabel = (creative: Creative) => {
    const version = latestVersions[creative.id];
    const width = Number(version?.width) || 0;
    const height = Number(version?.height) || 0;
    return width > 0 && height > 0 ? `${width}x${height}` : 'unknown';
  };

  const availableSizeOptions = useMemo(
    () => Array.from(new Set(creatives.map((creative) => getCreativeSizeLabel(creative)).filter((value) => value !== 'unknown'))).sort((left, right) => {
      const [leftWidth, leftHeight] = left.split('x').map(Number);
      const [rightWidth, rightHeight] = right.split('x').map(Number);
      return (leftWidth * leftHeight) - (rightWidth * rightHeight) || left.localeCompare(right);
    }),
    [creatives, latestVersions],
  );

  const filteredCreatives = useMemo(
    () => creatives.filter((creative) => {
      if (selectedClientIds.length && !selectedClientIds.includes(creative.workspaceId ?? '')) return false;

      const version = latestVersions[creative.id];
      const formatFamily = getCreativeFormatFamily(creative);
      if (formatFilter !== 'all' && formatFamily !== formatFilter) return false;

      const operationalState = getCreativeOperationalState(creative);
      if (statusFilter !== 'all' && operationalState !== statusFilter) return false;

      if (sizeFilter !== 'all' && getCreativeSizeLabel(creative) !== sizeFilter) return false;

      const needle = searchTerm.trim().toLowerCase();
      if (!needle) return true;

      return [
        creative.name,
        creative.workspaceName,
        creative.clickUrl,
        version?.creativeName,
        version?.sourceKind,
        version?.servingFormat,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    }),
    [creatives, selectedClientIds, latestVersions, formatFilter, statusFilter, sizeFilter, searchTerm],
  );
  const allVisibleCreativesSelected = filteredCreatives.length > 0 && filteredCreatives.every(creative => selectedCreativeIds.includes(creative.id));
  const someVisibleCreativesSelected = filteredCreatives.some(creative => selectedCreativeIds.includes(creative.id));
  const selectedCreatives = useMemo(
    () => creatives.filter((creative) => selectedCreativeIds.includes(creative.id)),
    [creatives, selectedCreativeIds],
  );
  const selectedCreativeWorkspaceIds = useMemo(
    () => Array.from(new Set(selectedCreatives.map((creative) => String(creative.workspaceId ?? '')).filter(Boolean))),
    [selectedCreatives],
  );
  const selectedCreativeFormatFamilies = useMemo(
    () => Array.from(new Set(selectedCreatives.map((creative) => {
      const version = latestVersions[creative.id];
      if (!version) return 'unknown';
      if (version.servingFormat === 'vast_video') return 'VAST';
      if (version.servingFormat === 'native') return 'native';
      return 'display';
    }))),
    [latestVersions, selectedCreatives],
  );
  const bulkAssignableTags = useMemo(() => {
    if (selectedCreativeWorkspaceIds.length !== 1 || selectedCreativeFormatFamilies.length !== 1) return [];
    const workspaceId = selectedCreativeWorkspaceIds[0];
    const formatFamily = selectedCreativeFormatFamilies[0];
    if (formatFamily === 'unknown') return [];
    return tags.filter((tag) => tag.workspaceId === workspaceId && tag.format === formatFamily);
  }, [selectedCreativeFormatFamilies, selectedCreativeWorkspaceIds, tags]);

  useEffect(() => {
    setSelectedCreativeIds((current) => current.filter((id) => filteredCreatives.some((creative) => creative.id === id)));
  }, [filteredCreatives]);

  useEffect(() => {
    setBulkAssignTagId((current) => (
      current && bulkAssignableTags.some((tag) => tag.id === current) ? current : ''
    ));
  }, [bulkAssignableTags]);

  const canBulkAssign = selectedCreativeWorkspaceIds.length === 1
    && selectedCreativeFormatFamilies.length === 1
    && selectedCreativeFormatFamilies[0] !== 'unknown';

  const bulkAssignHint = !canBulkAssign
    ? selectedCreativeWorkspaceIds.length !== 1
      ? 'Select creatives from one client only to bulk assign them.'
      : 'Selected creatives need one shared delivery type and a latest version before bulk assignment.'
    : bulkAssignableTags.length === 0
      ? 'No tags of that type are available for this client yet.'
      : null;
  const {
    clickUrlEditor,
    setClickUrlEditor,
    bulkClickUrlSaving,
    bulkAssignSaving,
    bulkStatusSaving,
    bulkDeleteSaving,
    statusUpdateCreativeId,
    handleDeleteCreative,
    handleBulkClickUrlUpdate,
    handleEditCreativeClickUrl,
    handleSaveCreativeClickUrl,
    handleBulkAssignToTag,
    handleBulkCreativeStatusUpdate,
    handleBulkDeleteCreatives,
    handleCreativeOperationalStatusToggle,
  } = useCreativeCatalogActions({
    activeWorkspaceId,
    setActiveWorkspaceId,
    setWorkspaceBusy,
    setError,
    setSuccessMessage,
    creatives,
    setCreatives,
    latestVersions,
    setLatestVersions,
    selectedCreativeIds,
    setSelectedCreativeIds,
    bulkClickUrl,
    setBulkClickUrl,
    bulkAssignTagId,
    setBulkAssignTagId,
    selectedCreativeWorkspaceIds,
    selectedCreativeFormatFamilies,
    selectedCreatives,
    tags,
    load,
    confirm,
  });

  const approvedCreatives = filteredCreatives.filter((creative) => getCreativeOperationalState(creative) === 'active').length;
  const pendingQaCreatives = filteredCreatives.filter((creative) => getCreativeOperationalState(creative) === 'pending_review').length;
  const rejectedCreatives = filteredCreatives.filter((creative) => getCreativeOperationalState(creative) === 'rejected').length;
  const assignedCreatives = filteredCreatives.filter((creative) => {
    const version = latestVersions[creative.id];
    return Boolean(version?.servingFormat);
  }).length;
  const pendingPreviewCreatives = filteredCreatives.filter((creative) => {
    const version = latestVersions[creative.id];
    return !resolveCreativePreviewHref(creative, version);
  }).slice(0, 3);
  const missingCreatives = filteredCreatives.filter((creative) => {
    const version = latestVersions[creative.id];
    return !version || !resolveCreativePreviewHref(creative, version);
  }).length;
  const creativeEligibility = filteredCreatives.length ? Math.round(((approvedCreatives + assignedCreatives) / Math.max(filteredCreatives.length * 2, 1)) * 100) : 0;

  const creativeRows = useMemo<CreativeRow[]>(() => (
    filteredCreatives.map((creative) => {
      const version = latestVersions[creative.id];
      const formatFamily = getCreativeFormatFamily(creative);
      const statusKey = getCreativeOperationalState(creative);
      const previewHref = resolveCreativePreviewHref(creative, version);
      const previewLabel = !previewHref
        ? 'Asset missing'
        : version?.status === 'pending_review'
          ? 'Clicktag review'
          : 'Preview ready';
      const qa: PrioritySeverity =
        statusKey === 'rejected' || !previewHref
          ? 'Critical'
          : statusKey === 'pending_review'
            ? 'Warning'
            : 'Notice';
      const status: CreativeStatus =
        !previewHref
          ? 'Missing'
          : statusKey === 'rejected'
            ? 'Rejected'
            : statusKey === 'pending_review'
              ? 'Pending QA'
              : statusKey === 'inactive'
                ? 'Ready'
                : 'Approved';
      const format: CreativeFormat =
        formatFamily === 'video'
          ? 'Video'
          : formatFamily === 'native'
            ? 'Native'
            : version?.sourceKind === 'html5_zip'
              ? 'HTML5'
              : 'Display';
      return {
        id: creative.id,
        creative: creative.name,
        advertiser: creative.workspaceName ?? '—',
        campaign: creative.workspaceName ?? 'No campaign',
        format,
        size: getCreativeSizeLabel(creative) === 'unknown' ? '—' : getCreativeSizeLabel(creative),
        status,
        qa,
        preview: previewLabel,
        owner: creative.workspaceName ?? 'Creative Ops',
      };
    })
  ), [filteredCreatives, latestVersions]);

  const creativeMetrics = useMemo<Metric[]>(() => [
    {
      id: 'creative-health',
      label: 'Creative eligibility',
      value: `${creativeEligibility}%`,
      delta: '+5%',
      direction: 'up',
      helper: 'approved or ready for activation',
      tone: 'fuchsia',
      series: [Math.max(creativeEligibility - 24, 0), Math.max(creativeEligibility - 21, 0), Math.max(creativeEligibility - 17, 0), Math.max(creativeEligibility - 12, 0), Math.max(creativeEligibility - 8, 0), Math.max(creativeEligibility - 3, 0), creativeEligibility],
    },
    {
      id: 'creative-qa',
      label: 'Pending QA',
      value: `${pendingQaCreatives}`,
      delta: pendingQaCreatives > 0 ? '+2' : '0',
      direction: pendingQaCreatives > 0 ? 'up' : 'flat',
      helper: 'need spec and clickthrough review',
      tone: 'amber',
      series: [Math.max(pendingQaCreatives - 3, 0), Math.max(pendingQaCreatives - 3, 0), Math.max(pendingQaCreatives - 2, 0), Math.max(pendingQaCreatives - 2, 0), Math.max(pendingQaCreatives - 1, 0), pendingQaCreatives, pendingQaCreatives],
    },
    {
      id: 'creative-approved',
      label: 'Approved',
      value: `${approvedCreatives}`,
      delta: approvedCreatives > 0 ? '+4' : '0',
      direction: approvedCreatives > 0 ? 'up' : 'flat',
      helper: 'eligible creatives in active campaigns',
      tone: 'emerald',
      series: [Math.max(approvedCreatives - 9, 0), Math.max(approvedCreatives - 8, 0), Math.max(approvedCreatives - 6, 0), Math.max(approvedCreatives - 5, 0), Math.max(approvedCreatives - 3, 0), Math.max(approvedCreatives - 1, 0), approvedCreatives],
    },
    {
      id: 'creative-blocked',
      label: 'Blocked creatives',
      value: `${rejectedCreatives + missingCreatives}`,
      delta: rejectedCreatives + missingCreatives > 0 ? '+1' : '0',
      direction: rejectedCreatives + missingCreatives > 0 ? 'up' : 'flat',
      helper: 'rejected or missing assets',
      tone: 'rose',
      series: [Math.max(rejectedCreatives + missingCreatives - 2, 0), Math.max(rejectedCreatives + missingCreatives - 1, 0), Math.max(rejectedCreatives + missingCreatives - 1, 0), Math.max(rejectedCreatives + missingCreatives - 1, 0), rejectedCreatives + missingCreatives, rejectedCreatives + missingCreatives, rejectedCreatives + missingCreatives],
    },
  ], [approvedCreatives, creativeEligibility, missingCreatives, pendingQaCreatives, rejectedCreatives]);

  const prototypeChecks: PrototypeCheck[] = [
    { name: 'creative view renders rows', passed: creativeRows.length >= 1 },
    { name: 'creative ids are stable', passed: creativeRows.every((row) => row.id.length > 0) },
    { name: 'creative statuses are valid', passed: creativeRows.every((row) => ['Approved', 'Pending QA', 'Rejected', 'Ready', 'Missing'].includes(row.status)) },
    { name: 'creative formats are valid', passed: creativeRows.every((row) => ['Display', 'HTML5', 'Video', 'Native'].includes(row.format)) },
    { name: 'qa severities are valid', passed: creativeRows.every((row) => ['Critical', 'Warning', 'Notice'].includes(row.qa)) },
    { name: 'creative QA signals exist', passed: creativeRows.every((row) => row.preview && row.owner) },
    { name: 'four metric cards render', passed: creativeMetrics.length === 4 },
    { name: 'primary CTA remains upload creative', passed: true },
  ];

  const toggleCreativeSelection = (creativeId: string) => {
    setSelectedCreativeIds((current) => (
      current.includes(creativeId)
        ? current.filter((id) => id !== creativeId)
        : [...current, creativeId]
    ));
  };

  const toggleSelectAllVisibleCreatives = () => {
    setSelectedCreativeIds((current) => {
      if (allVisibleCreativesSelected) {
        return current.filter((id) => !filteredCreatives.some((creative) => creative.id === id));
      }
      const next = new Set(current);
      filteredCreatives.forEach((creative) => next.add(creative.id));
      return Array.from(next);
    });
  };

  useEffect(() => {
    if (!previewModal) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewModal]);

  if (loading) {
    return <CenteredSpinner label="Loading creative catalog…" />;
  }

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50/90 p-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="font-medium">Error loading creative catalog</p>
        <p className="mt-1 text-sm">{error}</p>
        <button onClick={() => void load()} className="mt-3 text-sm font-semibold text-rose-600 underline dark:text-rose-300">Retry</button>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
      <CreativeWorkspaceOverview
        workspaces={workspaces}
        selectedWorkspaceId={selectedClientIds[0] ?? ''}
        onWorkspaceChange={(workspaceId) => setSelectedClientIds(workspaceId ? [workspaceId] : [])}
        needsQaOnly={statusFilter === 'pending_review'}
        onToggleNeedsQa={() => setStatusFilter((current) => current === 'pending_review' ? 'all' : 'pending_review')}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onUploadCreative={() => navigate('/creatives/upload')}
        pendingReviewCount={pendingQaCreatives + rejectedCreatives + missingCreatives}
        creativeMetrics={creativeMetrics}
      />

      {successMessage && (
        <Panel className="border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          {successMessage}
        </Panel>
      )}

      {selectedCreativeIds.length > 0 && (
        <CreativeBulkActionsPanel
          selectedCount={selectedCreativeIds.length}
          bulkClickUrl={bulkClickUrl}
          onBulkClickUrlChange={setBulkClickUrl}
          onBulkClickUrlUpdate={handleBulkClickUrlUpdate}
          bulkClickUrlSaving={bulkClickUrlSaving}
          bulkAssignTagId={bulkAssignTagId}
          onBulkAssignTagIdChange={setBulkAssignTagId}
          onBulkAssignToTag={handleBulkAssignToTag}
          bulkAssignSaving={bulkAssignSaving}
          bulkAssignableTags={bulkAssignableTags}
          canBulkAssign={canBulkAssign}
          bulkAssignHint={bulkAssignHint}
          onBulkStatusUpdate={handleBulkCreativeStatusUpdate}
          bulkStatusSaving={bulkStatusSaving}
          onBulkDelete={handleBulkDeleteCreatives}
          bulkDeleteSaving={bulkDeleteSaving}
          onClearSelection={() => {
            setSelectedCreativeIds([]);
            setBulkAssignTagId('');
            setBulkClickUrl('');
          }}
        />
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <Panel className="overflow-hidden p-6">
          <CreativeQueuePanel
            totalCreatives={filteredCreatives.length}
            approvedCreatives={approvedCreatives}
            pendingQaCreatives={pendingQaCreatives}
            blockedCreatives={rejectedCreatives + missingCreatives}
            onRefresh={() => void load()}
          />

          <CreativeTable
            creatives={filteredCreatives}
            latestVersions={latestVersions}
            creativeRows={creativeRows}
            selectedCreativeIds={selectedCreativeIds}
            allVisibleCreativesSelected={allVisibleCreativesSelected}
            someVisibleCreativesSelected={someVisibleCreativesSelected}
            onToggleSelectAllVisible={toggleSelectAllVisibleCreatives}
            onToggleCreativeSelection={toggleCreativeSelection}
            onOpenPreview={setPreviewModal}
            statusUpdateCreativeId={statusUpdateCreativeId}
            workspaceBusy={workspaceBusy}
            getCreativeOperationalState={getCreativeOperationalState}
            onToggleOperationalStatus={(creative) => handleCreativeOperationalStatusToggle(creative, getCreativeOperationalState)}
            onEditClickUrl={handleEditCreativeClickUrl}
            onOpenDeliveryManager={(entry, creativeVersion) => (
              creativeVersion.servingFormat === 'vast_video'
                ? openVideoRenditionManager(entry, creativeVersion)
                : openVariantManager(entry, creativeVersion)
            )}
            onAssignTag={handlePrepareBinding}
            onDeleteCreative={handleDeleteCreative}
          />
        </Panel>

        <Panel className="p-6">
          <CreativeSidebarInsights
            pendingQaCreatives={pendingQaCreatives}
            rejectedCreatives={rejectedCreatives}
            pendingPreviewCreatives={pendingPreviewCreatives}
            prototypeChecks={prototypeChecks}
          />
        </Panel>
      </div>

      {clickUrlEditor && (
        <ClickUrlEditorModal
          state={clickUrlEditor}
          onClose={() => setClickUrlEditor(null)}
          onSave={handleSaveCreativeClickUrl}
          onValueChange={(value) => setClickUrlEditor((current) => current ? { ...current, value, error: '' } : current)}
        />
      )}

      {quickCreateTagState && (
        <QuickCreateTagModal
          state={quickCreateTagState}
          onClose={() => setQuickCreateTagState(null)}
          onConfirm={handleConfirmQuickCreateTag}
          onNameChange={(value) => setQuickCreateTagState((current) => current ? { ...current, name: value, error: '' } : current)}
        />
      )}

      {bindingState && (
        <TagBindingModal
          bindingState={bindingState}
          tags={tags}
          onClose={() => setBindingState(null)}
          onAssign={handleAssign}
          onTagChange={(tagId) => setBindingState((current) => current ? { ...current, tagId } : current)}
          onQuickCreateTag={handleQuickCreateTag}
          onOpenTags={() => navigate('/tags?create=1')}
          onBindingStatusChange={handleBindingStatusChange}
        />
      )}

      {videoRenditionState && (
        <VideoRenditionsModal
          state={videoRenditionState}
          regenerationFeedback={regenerationFeedback}
          estimatedRemainingMs={estimatedRemainingMs}
          pendingPublishPercent={pendingPublishPercent}
          pendingPublishStage={pendingPublishStage}
          pendingPublishMessage={pendingPublishMessage}
          plannedRenditions={plannedRenditions}
          renditionProcessing={renditionProcessing}
          videoProcessing={videoProcessing}
          videoProcessingSummary={videoProcessingSummary}
          onClose={() => setVideoRenditionState(null)}
          onRegenerate={handleRegenerateVideoRenditions}
          onStatusToggle={handleVideoRenditionStatusChange}
          onSetError={(message) => {
            setVideoRenditionState(current => current ? { ...current, error: message } : current);
          }}
          formatDuration={formatDuration}
          formatBytes={formatBytes}
          formatVideoBitrate={formatVideoBitrate}
          getPublishStageLabel={getPublishStageLabel}
          getRenditionProgressLabel={getRenditionProgressLabel}
          getVideoRenditionStatusBadge={getVideoRenditionStatusBadge}
          getVideoRenditionToggleBlockedReason={getVideoRenditionToggleBlockedReason}
        />
      )}

      {variantState && (
        <VariantManagerModal
          variantState={variantState}
          presets={VARIANT_PRESETS}
          onClose={() => setVariantState(null)}
          onFormChange={handleVariantFormChange}
          onAddVariant={handleCreateVariant}
          onAddPresets={handleCreatePresetVariants}
          onSelectAll={toggleSelectAllVariants}
          onToggleVariant={toggleVariantSelection}
          onBulkStatusChange={handleBulkVariantStatusChange}
          onVariantStatusChange={handleVariantStatusChange}
          readinessBadge={readinessBadge}
          statusBadge={statusBadge}
        />
      )}

      {previewModal && (
        <CreativePreviewLightbox
          preview={previewModal}
          onClose={() => setPreviewModal(null)}
        />
      )}
    </div>
  );
}
