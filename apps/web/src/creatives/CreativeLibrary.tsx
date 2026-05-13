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
import { CreativeQueuePanel } from './creative-library/CreativeQueuePanel';
import { CreativeTable } from './creative-library/CreativeTable';
import { useCreativeCatalogActions } from './creative-library/useCreativeCatalogActions';
import { useCreativeCatalogData } from './creative-library/useCreativeCatalogData';
import { useCreativeCatalogViewModel } from './creative-library/useCreativeCatalogViewModel';
import { QuickCreateTagModal } from './creative-library/QuickCreateTagModal';
import { TagBindingModal } from './creative-library/TagBindingModal';
import { useTagBindingManager } from './creative-library/useTagBindingManager';
import { useCreativeFilters } from './creative-library/useCreativeFilters';
import { useCreativeSelection } from './creative-library/useCreativeSelection';
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
import { getSavedView } from '../shared/saved-views';
import { Button, CenteredSpinner, Input, Kicker, Panel, SavedViewsMenu, useConfirm } from '../system';

export default function CreativesView() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQueryParam = searchParams.get('search') ?? '';
  const currentViewId = searchParams.get('view');
  const [bulkClickUrl, setBulkClickUrl] = useState('');
  const [bulkAssignTagId, setBulkAssignTagId] = useState('');
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);
  const filters = useCreativeFilters(searchQueryParam);
  const selection = useCreativeSelection();
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
    filters.setSearchTerm(searchQueryParam);
  }, [filters.setSearchTerm, searchQueryParam]);
  useEffect(() => {
    if (!currentViewId) return;
    let cancelled = false;
    void getSavedView(currentViewId)
      .then((view) => {
        if (cancelled) return;
        if (!view || view.surface !== 'creatives') {
          setSearchParams((params) => {
            const next = new URLSearchParams(params);
            next.delete('view');
            return next;
          });
          return;
        }
        const nextFilters = view.filters ?? {};
        filters.setSelectedClientIds(nextFilters.selectedWorkspaceId ? [String(nextFilters.selectedWorkspaceId)] : []);
        const nextStatusFilter = String(nextFilters.statusFilter ?? 'all');
        const normalizedStatusFilter = nextStatusFilter === 'active'
          ? 'live'
          : nextStatusFilter === 'pending_review' || nextStatusFilter === 'rejected'
            ? 'attention'
            : ['all', 'live', 'publishing', 'inactive', 'attention', 'preview'].includes(nextStatusFilter)
              ? nextStatusFilter
              : 'all';
        filters.setStatusFilter(normalizedStatusFilter as 'all' | 'live' | 'publishing' | 'inactive' | 'attention' | 'preview');
        filters.setFormatFilter((['all', 'video', 'display', 'native'].includes(String(nextFilters.formatFilter))
          ? nextFilters.formatFilter
          : 'all') as 'all' | 'video' | 'display' | 'native');
        filters.setSizeFilter(String(nextFilters.sizeFilter ?? 'all'));
        filters.setSearchTerm(String(nextFilters.searchTerm ?? ''));
      })
      .catch(() => {
        if (!cancelled) {
          setSearchParams((params) => {
            const next = new URLSearchParams(params);
            next.delete('view');
            return next;
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    currentViewId,
    filters.setFormatFilter,
    filters.setSearchTerm,
    filters.setSelectedClientIds,
    filters.setSizeFilter,
    filters.setStatusFilter,
    setSearchParams,
  ]);
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
    attentionCreatives,
    creativeRows,
    toggleCreativeSelection,
    toggleSelectAllVisibleCreatives,
  } = useCreativeCatalogViewModel({
    creatives,
    latestVersions,
    ingestions,
    tags,
    selectedClientIds: filters.selectedClientIds,
    formatFilter: filters.formatFilter,
    statusFilter: filters.statusFilter,
    sizeFilter: filters.sizeFilter,
    searchTerm: filters.searchTerm,
    selectedCreativeIds: selection.selectedCreativeIds,
    setSelectedCreativeIds: selection.setSelectedCreativeIds,
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
    selectedCreativeIds: selection.selectedCreativeIds,
    setSelectedCreativeIds: selection.setSelectedCreativeIds,
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
      <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-[color:var(--dusk-status-critical-fg)]" role="alert" aria-live="assertive">
        <p className="font-medium">Error loading creative catalog</p>
        <p className="mt-1 text-sm">{error}</p>
        <Button variant="ghost" size="sm" onClick={() => void load()} className="mt-3">
          Retry
        </Button>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
      <CreativeWorkspaceOverview
        secondaryActions={(
          <SavedViewsMenu
            surface="creatives"
            currentFilters={{
              selectedWorkspaceId: filters.selectedClientIds[0] ?? '',
              statusFilter: filters.statusFilter,
              formatFilter: filters.formatFilter,
              sizeFilter: filters.sizeFilter,
              searchTerm: filters.searchTerm,
            }}
            currentViewId={currentViewId}
            onApplyView={(view) => {
              const nextSearch = String(view.filters?.searchTerm ?? '');
              setSearchParams((params) => {
                const next = new URLSearchParams(params);
                next.set('view', view.id);
                if (nextSearch) next.set('search', nextSearch);
                else next.delete('search');
                return next;
              });
            }}
            onClearView={() => {
              setSearchParams((params) => {
                const next = new URLSearchParams(params);
                next.delete('view');
                return next;
              });
            }}
          />
        )}
        workspaces={workspaces}
        selectedWorkspaceId={filters.selectedClientIds[0] ?? ''}
        onWorkspaceChange={(workspaceId) => filters.setSelectedClientIds(workspaceId ? [workspaceId] : [])}
        statusFilter={filters.statusFilter}
        onStatusFilterChange={filters.setStatusFilter}
        formatFilter={filters.formatFilter}
        onFormatFilterChange={filters.setFormatFilter}
        sizeFilter={filters.sizeFilter}
        onSizeFilterChange={filters.setSizeFilter}
        sizeOptions={availableSizeOptions}
        searchTerm={filters.searchTerm}
        onSearchChange={filters.setSearchTerm}
        onUploadCreative={() => navigate('/creatives/upload')}
        attentionCount={attentionCreatives}
      />

      {successMessage && (
        <Panel className="border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-success-fg)]" role="status" aria-live="polite">
          {successMessage}
        </Panel>
      )}

      {selection.selectedCreativeIds.length > 0 && (
        <CreativeBulkActionsPanel
          selectedCount={selection.selectedCreativeIds.length}
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
            selection.clearSelection();
            setBulkAssignTagId('');
            setBulkClickUrl('');
          }}
        />
      )}

      <Panel className="overflow-hidden p-6">
        <CreativeQueuePanel
          onRefresh={() => void load()}
        />

        <CreativeTable
          creatives={filteredCreatives}
          latestVersions={latestVersions}
          creativeRows={creativeRows}
          selectedCreativeIds={selection.selectedCreativeIds}
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
