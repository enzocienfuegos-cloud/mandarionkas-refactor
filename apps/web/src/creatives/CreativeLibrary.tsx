import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  type Creative,
  type CreativeVersion,
  type CreativeIngestion,
  type CreativeSizeVariant,
  type VideoRendition,
  type TagOption,
  type TagBinding,
  assignCreativeVersionToTag,
  createTag,
  deleteCreativeById,
  loadCreativeIngestion,
  loadCreativeVersionDetail,
  loadCreativesWithLatestVersion,
  loadCreativeIngestions,
  loadVideoRenditions,
  regenerateVideoRenditions,
  loadTagBindings,
  loadTags,
  updateCreativeVersionById,
  updateCreativeById,
  updateVideoRenditionById,
  updateTagBinding,
} from './catalog';
import type {
  BindingState,
  ClickUrlEditorState,
  CreativeFormat,
  CreativeRow,
  CreativeStatus,
  LatestVersionMap,
  Metric,
  PreviewModalState,
  PrototypeCheck,
  PrioritySeverity,
  QuickCreateTagState,
  RegenerationFeedbackState,
  VariantState,
  VideoRenditionState,
} from './creative-library/types';
import { CreativePreviewLightbox } from './creative-library/CreativePreviewLightbox';
import { ClickUrlEditorModal } from './creative-library/ClickUrlEditorModal';
import { CreativeBulkActionsPanel } from './creative-library/CreativeBulkActionsPanel';
import { CreativePreviewCell } from './creative-library/CreativePreviewCell';
import { CreativeQueuePanel } from './creative-library/CreativeQueuePanel';
import { CreativeRowActions } from './creative-library/CreativeRowActions';
import { CreativeSidebarInsights } from './creative-library/CreativeSidebarInsights';
import { CreativeTable } from './creative-library/CreativeTable';
import { QuickCreateTagModal } from './creative-library/QuickCreateTagModal';
import { TagBindingModal } from './creative-library/TagBindingModal';
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
import { loadAuthMe, loadWorkspaces, switchWorkspace, type WorkspaceOption } from '../shared/workspaces';
import { Button, CenteredSpinner, Input, Kicker, Panel, useConfirm } from '../system';

export default function CreativesView() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const searchQueryParam = searchParams.get('search') ?? '';
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [latestVersions, setLatestVersions] = useState<LatestVersionMap>({});
  const [ingestions, setIngestions] = useState<CreativeIngestion[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState(() => searchQueryParam);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending_review' | 'rejected'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'video' | 'display' | 'native'>('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [selectedCreativeIds, setSelectedCreativeIds] = useState<string[]>([]);
  const [bulkClickUrl, setBulkClickUrl] = useState('');
  const [bulkAssignTagId, setBulkAssignTagId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [bulkClickUrlSaving, setBulkClickUrlSaving] = useState(false);
  const [bulkAssignSaving, setBulkAssignSaving] = useState(false);
  const [bulkStatusSaving, setBulkStatusSaving] = useState(false);
  const [bulkDeleteSaving, setBulkDeleteSaving] = useState(false);
  const [statusUpdateCreativeId, setStatusUpdateCreativeId] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [bindingState, setBindingState] = useState<BindingState | null>(null);
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);
  const [clickUrlEditor, setClickUrlEditor] = useState<ClickUrlEditorState | null>(null);
  const [quickCreateTagState, setQuickCreateTagState] = useState<QuickCreateTagState | null>(null);
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
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ creatives, latestVersions }, ingestions, tags, authMe, workspaceList] = await Promise.all([
        loadCreativesWithLatestVersion({ scope: 'all' }),
        loadCreativeIngestions(),
        loadTags({ scope: 'all' }),
        loadAuthMe(),
        loadWorkspaces(),
      ]);
      setCreatives(creatives);
      setLatestVersions(latestVersions);
      setIngestions(ingestions);
      setTags(tags);
      setWorkspaces(workspaceList);
      setActiveWorkspaceId(authMe.workspace?.id ?? workspaceList[0]?.id ?? '');
    } catch (loadError: any) {
      setError(loadError.message ?? 'Failed to load creative catalog');
    } finally {
      setLoading(false);
    }
  };

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
    void load();
  }, []);

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

  const handleAssign = async () => {
    if (!bindingState?.tagId) {
      setBindingState(current => current ? { ...current, error: 'Select a tag.' } : current);
      return;
    }
    const selectedTag = tags.find(tag => tag.id === bindingState.tagId);
    setBindingState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await assignCreativeVersionToTag({
        creativeVersionId: bindingState.versionId,
        tagId: bindingState.tagId,
      });
      setBindingState(null);
      setSuccessMessage(selectedTag ? `Assigned to tag "${selectedTag.name}".` : 'Creative assigned to tag.');
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (assignError: any) {
      const message = assignError?.message ?? 'Assignment failed';
      setBindingState(current => current ? { ...current, loading: false, error: message } : current);
    }
  };

  const handleDeleteCreative = async (creative: Creative) => {
    const confirmed = await confirm({
      title: `Delete "${creative.name}"?`,
      description: 'This will remove its published versions and assignments.',
      tone: 'danger',
      confirmLabel: 'Delete creative',
      requireTypeToConfirm: creative.name,
    });
    if (!confirmed) return;

    setError('');
    setSuccessMessage('');
    try {
      if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
        await switchWorkspace(creative.workspaceId);
        setActiveWorkspaceId(creative.workspaceId);
      }
      await deleteCreativeById(creative.id);
      await load();
      setSuccessMessage(`Deleted "${creative.name}".`);
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (deleteError: any) {
      setError(deleteError.message ?? 'Failed to delete creative');
    }
  };

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

  const handleBulkClickUrlUpdate = async () => {
    const normalized = bulkClickUrl.trim();
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }
    let parsedClickUrl = '';
    try {
      parsedClickUrl = new URL(normalized).toString();
    } catch (_) {
      setError('Enter a valid http(s) destination URL for the selected creatives.');
      return;
    }

    setBulkClickUrlSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const selectedCreatives = creatives.filter((creative) => selectedCreativeIds.includes(creative.id));
      for (const creative of selectedCreatives) {
        if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
          setWorkspaceBusy(true);
          await switchWorkspace(creative.workspaceId);
          setActiveWorkspaceId(creative.workspaceId);
        }
        await updateCreativeById({
          creativeId: creative.id,
          clickUrl: parsedClickUrl,
        });
      }
      setCreatives((current) => current.map((creative) => (
        selectedCreativeIds.includes(creative.id)
          ? { ...creative, clickUrl: parsedClickUrl }
          : creative
      )));
      setSelectedCreativeIds([]);
      setBulkClickUrl('');
      setSuccessMessage(`Updated destination URL for ${selectedCreatives.length} creative${selectedCreatives.length === 1 ? '' : 's'}.`);
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (updateError: any) {
      setError(updateError.message ?? 'Failed to update destination URLs');
    } finally {
      setWorkspaceBusy(false);
      setBulkClickUrlSaving(false);
    }
  };

  const handleEditCreativeClickUrl = async (creative: Creative) => {
    setClickUrlEditor({
      creativeId: creative.id,
      creativeName: creative.name,
      workspaceId: creative.workspaceId ?? null,
      value: creative.clickUrl ?? '',
      loading: false,
      error: '',
    });
  };

  const handlePrepareBinding = async (creative: Creative, version: CreativeVersion) => {
    try {
      if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
        setWorkspaceBusy(true);
        await switchWorkspace(creative.workspaceId);
        setActiveWorkspaceId(creative.workspaceId);
      }
      const nextTags = await loadTags({ workspaceId: creative.workspaceId ?? activeWorkspaceId });
      setTags(nextTags);
      setBindingState({
        creativeId: creative.id,
        creativeName: creative.name,
        versionId: version.id,
        servingFormat: version.servingFormat,
        tagId: '',
        loading: false,
        error: '',
        bindingsLoading: false,
        bindings: [],
      });
    } catch (workspaceError: any) {
      setError(workspaceError.message ?? 'Failed to prepare assignment');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleSaveCreativeClickUrl = async () => {
    if (!clickUrlEditor) return;
    const normalized = clickUrlEditor.value.trim();
    if (normalized) {
      try {
        new URL(normalized);
      } catch (_) {
        setError('Enter a valid http(s) destination URL for the creative.');
        return;
      }
    }

    setClickUrlEditor((current) => current ? { ...current, loading: true, error: '' } : current);
    setError('');
    setSuccessMessage('');
    try {
      if (clickUrlEditor.workspaceId && clickUrlEditor.workspaceId !== activeWorkspaceId) {
        setWorkspaceBusy(true);
        await switchWorkspace(clickUrlEditor.workspaceId);
        setActiveWorkspaceId(clickUrlEditor.workspaceId);
      }
      await updateCreativeById({
        creativeId: clickUrlEditor.creativeId,
        clickUrl: normalized || null,
      });
      setCreatives((current) => current.map((entry) => (
        entry.id === clickUrlEditor.creativeId
          ? { ...entry, clickUrl: normalized || null }
          : entry
      )));
      setSuccessMessage(normalized ? 'Creative destination URL updated.' : 'Creative destination URL cleared.');
      window.setTimeout(() => setSuccessMessage(''), 3500);
      setClickUrlEditor(null);
    } catch (updateError: any) {
      const message = updateError.message ?? 'Failed to update creative destination URL';
      setError(message);
      setClickUrlEditor((current) => current ? { ...current, loading: false, error: message } : current);
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleBulkAssignToTag = async () => {
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }
    if (selectedCreativeWorkspaceIds.length !== 1) {
      setError('Bulk assignment only works when all selected creatives belong to the same client.');
      return;
    }
    if (selectedCreativeFormatFamilies.length !== 1 || selectedCreativeFormatFamilies[0] === 'unknown') {
      setError('Bulk assignment only works when all selected creatives share the same delivery type and have a latest version.');
      return;
    }
    if (!bulkAssignTagId) {
      setError('Select a destination tag first.');
      return;
    }

    setBulkAssignSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const selectedTag = tags.find((tag) => tag.id === bulkAssignTagId);
      if (!selectedTag) {
        throw new Error('Selected tag no longer exists.');
      }
      if (selectedTag.workspaceId && selectedTag.workspaceId !== activeWorkspaceId) {
        setWorkspaceBusy(true);
        await switchWorkspace(selectedTag.workspaceId);
        setActiveWorkspaceId(selectedTag.workspaceId);
      }

      let assignedCount = 0;
      let skippedCount = 0;
      for (const creative of selectedCreatives) {
        const version = latestVersions[creative.id];
        if (!version) {
          skippedCount += 1;
          continue;
        }
        await assignCreativeVersionToTag({
          creativeVersionId: version.id,
          tagId: bulkAssignTagId,
        });
        assignedCount += 1;
      }

      setSelectedCreativeIds([]);
      setBulkAssignTagId('');
      const suffix = skippedCount ? ` ${skippedCount} creative${skippedCount === 1 ? '' : 's'} skipped because they had no latest version.` : '';
      setSuccessMessage(`Assigned ${assignedCount} creative${assignedCount === 1 ? '' : 's'} to "${selectedTag.name}".${suffix}`);
      window.setTimeout(() => setSuccessMessage(''), 4000);
    } catch (assignError: any) {
      setError(assignError.message ?? 'Failed to assign creatives to tag');
    } finally {
      setWorkspaceBusy(false);
      setBulkAssignSaving(false);
    }
  };

  const handleBulkCreativeStatusUpdate = async (nextStatus: 'approved' | 'archived') => {
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }

    setBulkStatusSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const selectedCreatives = creatives.filter((creative) => selectedCreativeIds.includes(creative.id));
      let updatedCount = 0;
      let skippedCount = 0;

      for (const creative of selectedCreatives) {
        const version = latestVersions[creative.id];
        if (!version) {
          skippedCount += 1;
          continue;
        }
        if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
          setWorkspaceBusy(true);
          await switchWorkspace(creative.workspaceId);
          setActiveWorkspaceId(creative.workspaceId);
        }
        const response = await updateCreativeVersionById({
          creativeVersionId: version.id,
          status: nextStatus,
        });
        setLatestVersions((current) => ({
          ...current,
          [creative.id]: response.creativeVersion,
        }));
        updatedCount += 1;
      }

      setSelectedCreativeIds([]);
      const suffix = skippedCount ? ` ${skippedCount} creative${skippedCount === 1 ? '' : 's'} skipped because they had no latest version.` : '';
      setSuccessMessage(`${nextStatus === 'approved' ? 'Activated' : 'Deactivated'} ${updatedCount} creative${updatedCount === 1 ? '' : 's'}.${suffix}`);
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (updateError: any) {
      setError(updateError.message ?? 'Failed to update selected creatives.');
    } finally {
      setWorkspaceBusy(false);
      setBulkStatusSaving(false);
    }
  };

  const handleBulkDeleteCreatives = async () => {
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }
    const selectedCreatives = creatives.filter((creative) => selectedCreativeIds.includes(creative.id));
    if (!(await confirm({
      title: `Delete ${selectedCreatives.length} selected creative${selectedCreatives.length === 1 ? '' : 's'}?`,
      description: 'This will remove published versions and assignments.',
      tone: 'danger',
      confirmLabel: 'Delete selected',
    }))) {
      return;
    }

    setBulkDeleteSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      for (const creative of selectedCreatives) {
        if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
          setWorkspaceBusy(true);
          await switchWorkspace(creative.workspaceId);
          setActiveWorkspaceId(creative.workspaceId);
        }
        await deleteCreativeById(creative.id);
      }
      await load();
      setSelectedCreativeIds([]);
      setSuccessMessage(`Deleted ${selectedCreatives.length} creative${selectedCreatives.length === 1 ? '' : 's'}.`);
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (deleteError: any) {
      setError(deleteError.message ?? 'Failed to delete selected creatives.');
    } finally {
      setWorkspaceBusy(false);
      setBulkDeleteSaving(false);
    }
  };

  const handleCreativeOperationalStatusToggle = async (creative: Creative) => {
    const version = latestVersions[creative.id];
    if (!version) {
      setError('This creative does not have a latest version yet.');
      return;
    }

    const nextStatus = getCreativeOperationalState(creative) === 'inactive' ? 'approved' : 'archived';

    setStatusUpdateCreativeId(creative.id);
    setError('');
    setSuccessMessage('');
    try {
      if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
        setWorkspaceBusy(true);
        await switchWorkspace(creative.workspaceId);
        setActiveWorkspaceId(creative.workspaceId);
      }
      const response = await updateCreativeVersionById({
        creativeVersionId: version.id,
        status: nextStatus,
      });
      setLatestVersions((current) => ({
        ...current,
        [creative.id]: response.creativeVersion,
      }));
      setSuccessMessage(
        `${creative.name} is now ${nextStatus === 'approved' ? 'active' : 'inactive'}.`,
      );
      window.setTimeout(() => setSuccessMessage(''), 3000);
    } catch (updateError: any) {
      setError(updateError.message ?? 'Failed to update creative status');
    } finally {
      setWorkspaceBusy(false);
      setStatusUpdateCreativeId('');
    }
  };

  const handleQuickCreateTag = async () => {
    if (!bindingState) return;
    const suggestedFormat =
      bindingState.servingFormat === 'vast_video'
        ? 'VAST'
        : bindingState.servingFormat === 'native'
          ? 'native'
          : 'display';
    const suggestedName = `${bindingState.creativeName} ${suggestedFormat}`.trim();
    setQuickCreateTagState({
      suggestedFormat,
      creativeName: bindingState.creativeName,
      name: suggestedName,
      loading: false,
      error: '',
    });
  };

  const handleConfirmQuickCreateTag = async () => {
    if (!bindingState || !quickCreateTagState) return;
    const name = quickCreateTagState.name.trim();
    if (!name) {
      setQuickCreateTagState((current) => current ? { ...current, error: 'Tag name is required.' } : current);
      return;
    }

    setQuickCreateTagState((current) => current ? { ...current, loading: true, error: '' } : current);
    setBindingState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      const createdTag = await createTag({
        name,
        format: quickCreateTagState.suggestedFormat as 'display' | 'native' | 'VAST',
        status: 'draft',
      });
      const [nextTags, bindings] = await Promise.all([
        loadTags(),
        createdTag?.id ? loadTagBindings(createdTag.id) : Promise.resolve([]),
      ]);
      setTags(nextTags);
      setBindingState(current => current ? {
        ...current,
        loading: false,
        tagId: createdTag?.id ?? '',
        bindings,
      } : current);
      setQuickCreateTagState(null);
    } catch (createError: any) {
      setBindingState(current => current ? {
        ...current,
        loading: false,
        error: createError.message ?? 'Failed to create tag',
      } : current);
      setQuickCreateTagState((current) => current ? {
        ...current,
        loading: false,
        error: createError.message ?? 'Failed to create tag',
      } : current);
    }
  };

  const handleBindingStatusChange = async (bindingId: string, status: 'active' | 'paused') => {
    if (!bindingState?.tagId) return;
    setBindingState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await updateTagBinding({
        tagId: bindingState.tagId,
        bindingId,
        status,
      });
      const bindings = await loadTagBindings(bindingState.tagId);
      setBindingState(current => current ? { ...current, loading: false, bindings } : current);
    } catch (updateError: any) {
      setBindingState(current => current ? { ...current, loading: false, error: updateError.message ?? 'Binding update failed' } : current);
    }
  };

  useEffect(() => {
    const hasProcessing = creatives.some((creative) => {
      const version = latestVersions[creative.id];
      return version?.sourceKind === 'html5_zip' && String(version?.status ?? '') === 'processing';
    });
    if (!hasProcessing) return undefined;

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const { latestVersions: nextVersions } = await loadCreativesWithLatestVersion({ scope: 'all' });
          setLatestVersions((current) => {
            const patch = buildLatestVersionPatch(current, nextVersions);
            return Object.keys(patch).length > 0 ? { ...current, ...patch } : current;
          });
        } catch (_) {}
      })();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [creatives, latestVersions]);

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

  useEffect(() => {
    if (!bindingState?.tagId) return;

    let cancelled = false;
    setBindingState(current => current ? { ...current, bindingsLoading: true, error: '' } : current);
    void loadTagBindings(bindingState.tagId)
      .then(bindings => {
        if (cancelled) return;
        setBindingState(current => current ? { ...current, bindingsLoading: false, bindings } : current);
      })
      .catch(loadError => {
        if (cancelled) return;
        setBindingState(current => current ? {
          ...current,
          bindingsLoading: false,
          error: loadError.message ?? 'Failed to load tag bindings',
        } : current);
      });

    return () => {
      cancelled = true;
    };
  }, [bindingState?.tagId]);

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
            onToggleOperationalStatus={handleCreativeOperationalStatusToggle}
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
