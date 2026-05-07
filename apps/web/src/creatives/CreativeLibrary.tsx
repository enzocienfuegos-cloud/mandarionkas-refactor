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
import type { PreviewModalState } from './creative-library/types';
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
import { useCreativeCatalogViewModel } from './creative-library/useCreativeCatalogViewModel';
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
  const {
    getCreativeOperationalState,
    availableSizeOptions,
    filteredCreatives,
    allVisibleCreativesSelected,
    someVisibleCreativesSelected,
    selectedCreatives,
    selectedCreativeWorkspaceIds,
    selectedCreativeFormatFamilies,
    bulkAssignableTags,
    canBulkAssign,
    bulkAssignHint,
    approvedCreatives,
    pendingQaCreatives,
    rejectedCreatives,
    pendingPreviewCreatives,
    missingCreatives,
    creativeRows,
    creativeMetrics,
    prototypeChecks,
    toggleCreativeSelection,
    toggleSelectAllVisibleCreatives,
  } = useCreativeCatalogViewModel({
    creatives,
    latestVersions,
    tags,
    selectedClientIds,
    formatFilter,
    statusFilter,
    sizeFilter,
    searchTerm,
    selectedCreativeIds,
    setSelectedCreativeIds,
    bulkAssignTagId,
    setBulkAssignTagId,
  });
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
      <Panel className="border-rose-200 bg-rose-50/90 p-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200" role="alert" aria-live="assertive">
        <p className="font-medium">Error loading creative catalog</p>
        <p className="mt-1 text-sm">{error}</p>
        <Button variant="ghost" size="sm" onClick={() => void load()} className="mt-3 text-rose-600 dark:text-rose-300">
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
      <CreativeWorkspaceOverview
        workspaces={workspaces}
        selectedWorkspaceId={selectedClientIds[0] ?? ''}
        onWorkspaceChange={(workspaceId) => setSelectedClientIds(workspaceId ? [workspaceId] : [])}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        formatFilter={formatFilter}
        onFormatFilterChange={setFormatFilter}
        sizeFilter={sizeFilter}
        onSizeFilterChange={setSizeFilter}
        sizeOptions={availableSizeOptions}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onUploadCreative={() => navigate('/creatives/upload')}
        pendingReviewCount={pendingQaCreatives + rejectedCreatives + missingCreatives}
        creativeMetrics={creativeMetrics}
      />

      {successMessage && (
        <Panel className="border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200" role="status" aria-live="polite">
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
