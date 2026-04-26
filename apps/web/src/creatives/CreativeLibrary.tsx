import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  createCreativeSizeVariant,
  createCreativeSizeVariantsBulk,
  deleteCreativeById,
  loadCreativeIngestion,
  loadCreativeVersionDetail,
  loadCreativesWithLatestVersion,
  loadCreativeIngestions,
  loadCreativeSizeVariants,
  loadVideoRenditions,
  regenerateVideoRenditions,
  loadTagBindings,
  loadTags,
  updateCreativeSizeVariant,
  updateCreativeSizeVariantsBulkStatus,
  updateCreativeById,
  updateVideoRenditionById,
  updateTagBinding,
} from './catalog';
import { loadAuthMe, loadWorkspaces, switchWorkspace, type WorkspaceOption } from '../shared/workspaces';

function formatBytes(value?: number | null) {
  if (!value) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = units[0];
  for (let index = 0; index < units.length - 1 && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index + 1];
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
}

function statusBadge(status?: string) {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    pending_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-700',
    published: 'bg-blue-100 text-blue-700',
    validated: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-rose-100 text-rose-700',
    processing: 'bg-purple-100 text-purple-700',
    uploaded: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status ?? 'draft'] ?? map.draft}`}>
      {(status ?? 'draft').replace(/_/g, ' ')}
    </span>
  );
}

function readinessBadge(variant: CreativeSizeVariant) {
  const ready = Boolean(variant.publicUrl) && (variant.status === 'active' || variant.status === 'draft' || variant.status === 'paused');
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
      ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
    }`}>
      {ready ? 'Ready' : 'Needs artifact'}
    </span>
  );
}

function formatVideoBitrate(value?: number | null) {
  if (!value) return '—';
  return `${Math.round(value)} kbps`;
}

type LatestVersionMap = Record<string, CreativeVersion | null>;

const VARIANT_PRESETS = [
  { label: '300x250', width: 300, height: 250 },
  { label: '320x50', width: 320, height: 50 },
  { label: '320x100', width: 320, height: 100 },
  { label: '336x280', width: 336, height: 280 },
  { label: '728x90', width: 728, height: 90 },
  { label: '970x250', width: 970, height: 250 },
  { label: '160x600', width: 160, height: 600 },
  { label: '300x600', width: 300, height: 600 },
];

interface BindingState {
  creativeId: string;
  creativeName: string;
  versionId: string;
  servingFormat: string;
  tagId: string;
  loading: boolean;
  error: string;
  bindingsLoading: boolean;
  bindings: TagBinding[];
}

interface VariantState {
  creativeId: string;
  creativeName: string;
  versionId: string;
  loading: boolean;
  error: string;
  variants: CreativeSizeVariant[];
  selectedVariantIds: string[];
  form: {
    label: string;
    width: string;
    height: string;
  };
}

interface VideoRenditionState {
  creativeId: string;
  creativeName: string;
  workspaceId?: string | null;
  versionId: string;
  loading: boolean;
  error: string;
  version: CreativeVersion | null;
  renditions: VideoRendition[];
  pendingIngestion: CreativeIngestion | null;
  awaitingPublish: boolean;
}

interface RegenerationFeedbackState {
  active: boolean;
  startedAt: number;
  elapsedMs: number;
  stageLabel: string;
  progressPercent: number;
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function estimateRemainingDuration(elapsedMs: number, progressPercent: number) {
  if (progressPercent <= 0 || progressPercent >= 100) return null;
  const estimatedTotalMs = (elapsedMs / progressPercent) * 100;
  const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
  return remainingMs;
}

function estimateRegenerationFeedback(elapsedMs: number) {
  if (elapsedMs < 1200) {
    return {
      stageLabel: 'Preparing source video…',
      progressPercent: Math.min(18, 6 + Math.round((elapsedMs / 1200) * 12)),
    };
  }
  if (elapsedMs < 4000) {
    return {
      stageLabel: 'Analyzing source with ffprobe…',
      progressPercent: Math.min(38, 18 + Math.round(((elapsedMs - 1200) / 2800) * 20)),
    };
  }
  if (elapsedMs < 12000) {
    return {
      stageLabel: 'Transcoding renditions with FFmpeg…',
      progressPercent: Math.min(82, 38 + Math.round(((elapsedMs - 4000) / 8000) * 44)),
    };
  }
  if (elapsedMs < 20000) {
    return {
      stageLabel: 'Publishing rendition artifacts…',
      progressPercent: Math.min(94, 82 + Math.round(((elapsedMs - 12000) / 8000) * 12)),
    };
  }
  return {
    stageLabel: 'Finalizing rendition metadata…',
    progressPercent: 97,
  };
}

function getPublishJob(ingestion: CreativeIngestion | null | undefined) {
  const metadata = ingestion?.metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const publishJob = (metadata as Record<string, unknown>).publishJob;
  return publishJob && typeof publishJob === 'object'
    ? publishJob as Record<string, unknown>
    : null;
}

function getPublishStageLabel(stage: string | null | undefined, fallback = 'Publishing creative in background…') {
  switch (stage) {
    case 'queued':
      return 'Queued for worker pickup…';
    case 'starting':
      return 'Preparing background publish job…';
    case 'creating_catalog_record':
      return 'Creating creative and version records…';
    case 'publishing_html5_archive':
      return 'Publishing HTML5 assets…';
    case 'transcoding_video':
      return 'Transcoding video renditions with FFmpeg…';
    case 'finalizing_publication':
      return 'Saving rendition metadata and activating assets…';
    case 'completed':
      return 'Creative publish completed.';
    case 'failed':
      return 'Creative publish failed.';
    default:
      return fallback;
  }
}

function findPendingIngestionForCreative(
  ingestionList: CreativeIngestion[],
  creative: Creative,
  version: CreativeVersion,
) {
  const normalizedCreativeName = String(creative.name ?? '').trim().toLowerCase();
  const matches = ingestionList.filter((ingestion) => {
    const requestedName = String((ingestion.metadata as Record<string, unknown> | undefined)?.requestedName ?? '')
      .trim()
      .toLowerCase();
    const filenameBase = String(ingestion.originalFilename ?? '')
      .replace(/\.[^.]+$/, '')
      .trim()
      .toLowerCase();
    return (
      ingestion.creativeVersionId === version.id
      || ingestion.creativeId === creative.id
      || (!!normalizedCreativeName && requestedName === normalizedCreativeName)
      || (!!normalizedCreativeName && filenameBase === normalizedCreativeName)
    );
  });

  return matches
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ?? null;
}

export default function CreativeLibrary() {
  const navigate = useNavigate();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [latestVersions, setLatestVersions] = useState<LatestVersionMap>({});
  const [ingestions, setIngestions] = useState<CreativeIngestion[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedCreativeIds, setSelectedCreativeIds] = useState<string[]>([]);
  const [bulkClickUrl, setBulkClickUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [bulkClickUrlSaving, setBulkClickUrlSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [bindingState, setBindingState] = useState<BindingState | null>(null);
  const [variantState, setVariantState] = useState<VariantState | null>(null);
  const [videoRenditionState, setVideoRenditionState] = useState<VideoRenditionState | null>(null);
  const [regenerationFeedback, setRegenerationFeedback] = useState<RegenerationFeedbackState | null>(null);

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

  useEffect(() => {
    void load();
  }, []);

  const filteredCreatives = useMemo(
    () => creatives.filter(creative => !selectedClientIds.length || selectedClientIds.includes(creative.workspaceId ?? '')),
    [creatives, selectedClientIds],
  );
  const allVisibleCreativesSelected = filteredCreatives.length > 0 && filteredCreatives.every(creative => selectedCreativeIds.includes(creative.id));
  const someVisibleCreativesSelected = filteredCreatives.some(creative => selectedCreativeIds.includes(creative.id));

  useEffect(() => {
    setSelectedCreativeIds((current) => current.filter((id) => filteredCreatives.some((creative) => creative.id === id)));
  }, [filteredCreatives]);

  const summary = useMemo(() => {
    const versions = filteredCreatives.map(creative => latestVersions[creative.id]).filter(Boolean) as CreativeVersion[];
    return {
      totalCreatives: filteredCreatives.length,
      pendingReview: versions.filter(version => version.status === 'rejected').length,
      approved: versions.filter(version => ['approved', 'draft'].includes(version.status)).length,
      ingestions: ingestions.length,
    };
  }, [filteredCreatives, latestVersions, ingestions]);

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
    const confirmed = window.confirm(`Delete "${creative.name}"? This will remove its published versions and assignments.`);
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

  const handleQuickCreateTag = async () => {
    if (!bindingState) return;
    const suggestedFormat =
      bindingState.servingFormat === 'vast_video'
        ? 'VAST'
        : bindingState.servingFormat === 'native'
          ? 'native'
          : 'display';
    const suggestedName = `${bindingState.creativeName} ${suggestedFormat}`.trim();
    const name = window.prompt('Tag name', suggestedName);
    if (!name?.trim()) return;

    setBindingState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      const createdTag = await createTag({
        name: name.trim(),
        format: suggestedFormat,
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
    } catch (createError: any) {
      setBindingState(current => current ? {
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

  const openVariantManager = async (creative: Creative, version: CreativeVersion) => {
    setVariantState({
      creativeId: creative.id,
      creativeName: creative.name,
      versionId: version.id,
      loading: true,
      error: '',
      variants: [],
      selectedVariantIds: [],
      form: {
        label: version.width && version.height ? `${version.width}x${version.height}` : '',
        width: version.width ? String(version.width) : '',
        height: version.height ? String(version.height) : '',
      },
    });
    try {
      const variants = await loadCreativeSizeVariants(version.id);
      setVariantState(current => current ? { ...current, loading: false, variants, selectedVariantIds: [] } : current);
    } catch (loadError: any) {
      setVariantState(current => current ? {
        ...current,
        loading: false,
        error: loadError.message ?? 'Failed to load size variants',
        selectedVariantIds: [],
      } : current);
    }
  };

  const openVideoRenditionManager = async (creative: Creative, version: CreativeVersion) => {
    const pendingIngestion = findPendingIngestionForCreative(ingestions, creative, version);
    setVideoRenditionState({
      creativeId: creative.id,
      creativeName: creative.name,
      workspaceId: creative.workspaceId ?? null,
      versionId: version.id,
      loading: true,
      error: '',
      version,
      renditions: [],
      pendingIngestion,
      awaitingPublish: pendingIngestion?.status === 'processing',
    });
    try {
      const detail = await loadCreativeVersionDetail(version.id);
      setVideoRenditionState(current => current ? {
        ...current,
        loading: false,
        version: detail.creativeVersion,
        renditions: detail.videoRenditions,
        awaitingPublish: false,
      } : current);
    } catch (loadError: any) {
      const message = loadError.message ?? 'Failed to load video renditions';
      const missingVersion = String(message).toLowerCase().includes('creative version not found');
      setVideoRenditionState(current => current ? {
        ...current,
        loading: false,
        error: missingVersion && pendingIngestion?.status === 'processing'
          ? ''
          : message,
        awaitingPublish: missingVersion && pendingIngestion?.status === 'processing',
      } : current);
    }
  };

  const handleVariantStatusChange = async (variantId: string, status: 'active' | 'paused') => {
    setVariantState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await updateCreativeSizeVariant({ variantId, status });
      const variants = await loadCreativeSizeVariants(variantState?.versionId ?? '');
      setVariantState(current => current ? { ...current, loading: false, variants } : current);
    } catch (updateError: any) {
      setVariantState(current => current ? { ...current, loading: false, error: updateError.message ?? 'Failed to update variant' } : current);
    }
  };

  const handleVideoRenditionStatusChange = async (
    renditionId: string,
    status: 'active' | 'paused',
  ) => {
    if (!videoRenditionState) return;
    setVideoRenditionState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await updateVideoRenditionById({ renditionId, status });
      const detail = await loadCreativeVersionDetail(videoRenditionState.versionId);
      setVideoRenditionState(current => current ? {
        ...current,
        loading: false,
        version: detail.creativeVersion,
        renditions: detail.videoRenditions,
      } : current);
    } catch (updateError: any) {
      setVideoRenditionState(current => current ? {
        ...current,
        loading: false,
        error: updateError.message ?? 'Failed to update video rendition',
      } : current);
    }
  };

  const handleRegenerateVideoRenditions = async () => {
    if (!videoRenditionState) return;
    if (videoRenditionState.awaitingPublish) {
      setVideoRenditionState(current => current ? {
        ...current,
        error: 'This video is still publishing in the background. Renditions will appear when publishing completes.',
      } : current);
      return;
    }
    const startedAt = Date.now();
    const initialFeedback = estimateRegenerationFeedback(0);
    setRegenerationFeedback({
      active: true,
      startedAt,
      elapsedMs: 0,
      stageLabel: initialFeedback.stageLabel,
      progressPercent: initialFeedback.progressPercent,
    });
    setVideoRenditionState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await regenerateVideoRenditions(videoRenditionState.versionId);
      setRegenerationFeedback(current => current ? {
        ...current,
        elapsedMs: Date.now() - current.startedAt,
        stageLabel: 'Refreshing rendition details…',
        progressPercent: 98,
      } : current);
      const detail = await loadCreativeVersionDetail(videoRenditionState.versionId);
      setVideoRenditionState(current => current ? {
        ...current,
        loading: false,
        version: detail.creativeVersion,
        renditions: detail.videoRenditions,
      } : current);
      setRegenerationFeedback(current => current ? {
        ...current,
        active: false,
        elapsedMs: Date.now() - current.startedAt,
        stageLabel: 'Renditions updated',
        progressPercent: 100,
      } : current);
      await load();
      window.setTimeout(() => {
        setRegenerationFeedback(current => current?.progressPercent === 100 ? null : current);
      }, 1800);
    } catch (regenerateError: any) {
      setVideoRenditionState(current => current ? {
        ...current,
        loading: false,
        error: regenerateError.message ?? 'Failed to regenerate video renditions',
      } : current);
      setRegenerationFeedback(null);
    }
  };

  useEffect(() => {
    if (!regenerationFeedback?.active) return undefined;

    const intervalId = window.setInterval(() => {
      setRegenerationFeedback(current => {
        if (!current?.active) return current;
        const elapsedMs = Date.now() - current.startedAt;
        const estimate = estimateRegenerationFeedback(elapsedMs);
        return {
          ...current,
          elapsedMs,
          stageLabel: estimate.stageLabel,
          progressPercent: estimate.progressPercent,
        };
      });
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [regenerationFeedback?.active]);

  useEffect(() => {
    if (!videoRenditionState?.awaitingPublish || !videoRenditionState.pendingIngestion?.id) return undefined;

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const latestIngestion = await loadCreativeIngestion(videoRenditionState.pendingIngestion!.id, {
            workspaceId: videoRenditionState.workspaceId ?? undefined,
          });
          if (cancelled) return;

          setIngestions(current => current.map(ingestion => (
            ingestion.id === latestIngestion.id ? latestIngestion : ingestion
          )));

          if (latestIngestion.status === 'published' && latestIngestion.creativeVersionId) {
            try {
              const detail = await loadCreativeVersionDetail(latestIngestion.creativeVersionId);
              if (cancelled) return;
              setVideoRenditionState(current => current ? {
                ...current,
                versionId: latestIngestion.creativeVersionId ?? current.versionId,
                version: detail.creativeVersion,
                renditions: detail.videoRenditions,
                pendingIngestion: latestIngestion,
                awaitingPublish: false,
                loading: false,
                error: '',
              } : current);
              void load();
            } catch {
              if (cancelled) return;
            }
            return;
          }

          setVideoRenditionState(current => current ? {
            ...current,
            pendingIngestion: latestIngestion,
            awaitingPublish: latestIngestion.status === 'processing',
            error: latestIngestion.status === 'failed'
              ? latestIngestion.errorDetail ?? 'Background publish failed'
              : current.error,
          } : current);
        } catch {
          if (cancelled) return;
        }
      })();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    videoRenditionState?.awaitingPublish,
    videoRenditionState?.pendingIngestion?.id,
    videoRenditionState?.workspaceId,
  ]);

  const videoProcessing = (videoRenditionState?.version?.metadata as Record<string, any> | undefined)?.videoProcessing;
  const plannedRenditions = Array.isArray(videoProcessing?.targetPlan) ? videoProcessing.targetPlan : [];
  const renditionProcessing = Array.isArray(videoProcessing?.renditionProcessing) ? videoProcessing.renditionProcessing : [];
  const estimatedRemainingMs = regenerationFeedback
    ? estimateRemainingDuration(regenerationFeedback.elapsedMs, regenerationFeedback.progressPercent)
    : null;
  const pendingPublishJob = getPublishJob(videoRenditionState?.pendingIngestion);
  const pendingPublishPercent = Math.min(100, Math.max(0, Number(pendingPublishJob?.progressPercent ?? 0) || 0));
  const pendingPublishStage = String(pendingPublishJob?.stage ?? '');
  const pendingPublishMessage = String(
    pendingPublishJob?.message
    ?? getPublishStageLabel(pendingPublishStage),
  );

  const toggleVariantSelection = (variantId: string) => {
    setVariantState(current => {
      if (!current) return current;
      const selected = current.selectedVariantIds.includes(variantId)
        ? current.selectedVariantIds.filter(id => id !== variantId)
        : [...current.selectedVariantIds, variantId];
      return { ...current, selectedVariantIds: selected };
    });
  };

  const toggleSelectAllVariants = () => {
    setVariantState(current => {
      if (!current) return current;
      const selectableIds = current.variants.map(variant => variant.id);
      const selectedVariantIds = current.selectedVariantIds.length === selectableIds.length
        ? []
        : selectableIds;
      return { ...current, selectedVariantIds };
    });
  };

  const handleCreateVariant = async () => {
    if (!variantState) return;
    const width = Number(variantState.form.width);
    const height = Number(variantState.form.height);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      setVariantState(current => current ? { ...current, error: 'Width and height must be positive numbers.' } : current);
      return;
    }

    setVariantState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await createCreativeSizeVariant({
        creativeVersionId: variantState.versionId,
        label: variantState.form.label.trim() || `${width}x${height}`,
        width,
        height,
        status: 'draft',
      });
      const variants = await loadCreativeSizeVariants(variantState.versionId);
      setVariantState(current => current ? {
        ...current,
        loading: false,
        variants,
        selectedVariantIds: [],
        form: { ...current.form, label: '', width: '', height: '' },
      } : current);
    } catch (createError: any) {
      setVariantState(current => current ? { ...current, loading: false, error: createError.message ?? 'Failed to create variant' } : current);
    }
  };

  const handleCreatePresetVariants = async (presets: typeof VARIANT_PRESETS) => {
    if (!variantState || presets.length === 0) return;
    setVariantState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      const response = await createCreativeSizeVariantsBulk({
        creativeVersionId: variantState.versionId,
        variants: presets.map(preset => ({
          label: preset.label,
          width: preset.width,
          height: preset.height,
          status: 'draft',
        })),
      });
      setVariantState(current => current ? {
        ...current,
        loading: false,
        variants: response.variants,
        selectedVariantIds: [],
        error: response.skippedCount > 0 ? `${response.skippedCount} duplicate size(s) skipped.` : '',
      } : current);
    } catch (createError: any) {
      setVariantState(current => current ? { ...current, loading: false, error: createError.message ?? 'Failed to create preset sizes' } : current);
    }
  };

  const handleBulkVariantStatusChange = async (status: 'active' | 'paused') => {
    if (!variantState || variantState.selectedVariantIds.length === 0) {
      setVariantState(current => current ? { ...current, error: 'Select at least one size first.' } : current);
      return;
    }
    setVariantState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      const response = await updateCreativeSizeVariantsBulkStatus({
        creativeVersionId: variantState.versionId,
        variantIds: variantState.selectedVariantIds,
        status,
      });
      setVariantState(current => current ? {
        ...current,
        loading: false,
        variants: response.variants,
        selectedVariantIds: [],
      } : current);
    } catch (updateError: any) {
      setVariantState(current => current ? { ...current, loading: false, error: updateError.message ?? 'Failed to update selected sizes' } : current);
    }
  };

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
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Error loading creative catalog</p>
        <p className="mt-1 text-sm">{error}</p>
        <button onClick={() => void load()} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Creative Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload to a specific client, publish technically valid creatives, and assign them to tags.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/creatives/upload')}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Upload Creative
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Client</label>
        <select
          multiple
          value={selectedClientIds}
          onChange={event => setSelectedClientIds(Array.from(event.target.selectedOptions, option => option.value))}
          className="min-h-[110px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
        >
          {workspaces.map(workspace => (
            <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500">Leave empty to see all clients. Hold Cmd/Ctrl to select multiple.</span>
      </div>

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      {selectedCreativeIds.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium text-indigo-900">
                {selectedCreativeIds.length} creative{selectedCreativeIds.length === 1 ? '' : 's'} selected
              </div>
              <div className="mt-1 text-xs text-indigo-700">
                Apply one destination URL across the selected banners so you can update landing pages in bulk.
              </div>
            </div>
            <div className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
              <input
                value={bulkClickUrl}
                onChange={(event) => setBulkClickUrl(event.target.value)}
                placeholder="https://example.com/landing"
                className="min-w-0 flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => void handleBulkClickUrlUpdate()}
                disabled={bulkClickUrlSaving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {bulkClickUrlSaving ? 'Saving…' : 'Update destination URL'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Creatives</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.totalCreatives}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Needs attention</p>
          <p className="mt-2 text-2xl font-semibold text-yellow-700">{summary.pendingReview}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Ready to Tag</p>
          <p className="mt-2 text-2xl font-semibold text-green-700">{summary.approved}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Ingestions</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.ingestions}</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Creative Versions</h2>
          <button onClick={() => void load()} className="text-sm text-indigo-600 hover:text-indigo-700">Refresh</button>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleCreativesSelected}
                    ref={(element) => {
                      if (element) {
                        element.indeterminate = !allVisibleCreativesSelected && someVisibleCreativesSelected;
                      }
                    }}
                    onChange={toggleSelectAllVisibleCreatives}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    aria-label="Select all visible creatives"
                  />
                </th>
                <th className="px-4 py-3">Creative</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Destination URL</th>
                <th className="px-4 py-3">Preview</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCreatives.map(creative => {
                const version = latestVersions[creative.id];
                return (
                  <tr key={creative.id} className="align-top">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCreativeIds.includes(creative.id)}
                        onChange={() => toggleCreativeSelection(creative.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        aria-label={`Select creative ${creative.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{creative.name}</div>
                      <div className="text-xs text-slate-400">{creative.workspaceName ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {creative.createdAt ? new Date(creative.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {creative.clickUrl ? (
                        <a
                          href={creative.clickUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          {creative.clickUrl}
                        </a>
                      ) : (
                        <span className="text-rose-600">Missing URL</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {version?.publicUrl ? (
                        <a
                          href={version.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-slate-400">No public artifact</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {version && version.status !== 'rejected' && (
                          <>
                            <button
                              onClick={() => void (
                                version.servingFormat === 'vast_video'
                                  ? openVideoRenditionManager(creative, version)
                                  : openVariantManager(creative, version)
                              )}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {version.servingFormat === 'vast_video' ? 'Manage renditions' : 'Manage sizes'}
                            </button>
                            <button
                              onClick={async () => {
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
                              }}
                              className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                            >
                              Assign to tag
                            </button>
                            <button
                              onClick={() => void handleDeleteCreative(creative)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {!version && (
                          <button
                            onClick={() => void handleDeleteCreative(creative)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Recent Ingestions</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {ingestions.map(ingestion => (
            <div key={ingestion.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-800">{ingestion.originalFilename}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {ingestion.sourceKind} · {formatBytes(ingestion.sizeBytes)} · {new Date(ingestion.createdAt).toLocaleString()}
                  </div>
                </div>
                {statusBadge(ingestion.status)}
              </div>
              {ingestion.errorDetail && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{ingestion.errorDetail}</p>
              )}
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                <span>creative: {ingestion.creativeId ?? '—'}</span>
                <span>version: {ingestion.creativeVersionId ?? '—'}</span>
              </div>
            </div>
          ))}
          {ingestions.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No ingestions yet. Upload an HTML5 zip or MP4 to seed the new catalog.
            </div>
          )}
        </div>
      </section>

      {bindingState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800">Assign creative version to tag</h2>
            <p className="mt-1 text-sm text-slate-500">
              Assign this creative version to one or more delivery tags.
            </p>
            {bindingState.error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {bindingState.error}
              </div>
            )}
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Tag</label>
              <select
                value={bindingState.tagId}
                onChange={event => setBindingState(current => current ? { ...current, tagId: event.target.value } : current)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a tag</option>
                {tags.map(tag => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name} · {tag.format} · {tag.status}
                  </option>
                ))}
              </select>
              {tags.length === 0 && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  <p>No tags exist yet for this client.</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleQuickCreateTag()}
                      disabled={bindingState.loading}
                      className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                    >
                      Quick create tag
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/tags?create=1')}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open tags
                    </button>
                  </div>
                </div>
              )}
            </div>
            {bindingState.tagId && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-slate-800">Current assignments</h3>
                    <p className="text-xs text-slate-500">Review what this tag is already serving before you change it.</p>
                  </div>
                  {bindingState.bindingsLoading && (
                    <span className="text-xs text-slate-500">Loading…</span>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {bindingState.bindings.map(binding => {
                    const isCurrentVersion = binding.creativeVersionId === bindingState.versionId;
                    return (
                      <div key={binding.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-slate-800">{binding.creativeName}</span>
                              {statusBadge(binding.status)}
                              {isCurrentVersion && (
                                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                  Selected version
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {binding.sourceKind} · {binding.servingFormat} · weight {binding.weight}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {binding.status === 'active' ? (
                              <button
                                onClick={() => void handleBindingStatusChange(binding.id, 'paused')}
                                disabled={bindingState.loading}
                                className="rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                              >
                                Pause
                              </button>
                            ) : (
                              <button
                                onClick={() => void handleBindingStatusChange(binding.id, 'active')}
                                disabled={bindingState.loading}
                                className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!bindingState.bindingsLoading && bindingState.bindings.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                      This tag has no assignments yet.
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setBindingState(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAssign()}
                disabled={bindingState.loading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
              >
                {bindingState.loading ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {videoRenditionState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Video renditions</h2>
                <p className="mt-1 text-sm text-slate-500">{videoRenditionState.creativeName}</p>
              </div>
              <button
                onClick={() => setVideoRenditionState(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="max-w-2xl">
                  Manage which MP4 renditions are active for VAST delivery. The source file stays available as fallback, and transcoded renditions are served first when active.
                </p>
                <button
                  onClick={() => void handleRegenerateVideoRenditions()}
                  disabled={videoRenditionState.loading || videoRenditionState.awaitingPublish}
                  className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                >
                  {videoRenditionState.awaitingPublish
                    ? 'Publishing in background…'
                    : videoRenditionState.loading
                      ? 'Regenerating…'
                      : 'Regenerate renditions'}
                </button>
              </div>

              {videoRenditionState.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {videoRenditionState.error}
                </div>
              )}

              {videoRenditionState.awaitingPublish && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Video publish in progress</p>
                      <p className="mt-1 text-sm text-slate-600">{pendingPublishMessage}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        The creative version and renditions will appear here automatically when the background worker finishes.
                      </p>
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      <div className="font-semibold text-slate-800">{pendingPublishPercent}%</div>
                      <div>{getPublishStageLabel(pendingPublishStage)}</div>
                    </div>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/80">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
                      style={{ width: `${Math.max(8, pendingPublishPercent)}%` }}
                    />
                  </div>
                </div>
              )}

              {regenerationFeedback && (
                <div className={`rounded-xl border px-4 py-4 ${
                  regenerationFeedback.progressPercent === 100
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-indigo-200 bg-indigo-50'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {regenerationFeedback.progressPercent === 100 ? 'Regeneration complete' : 'Regeneration in progress'}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{regenerationFeedback.stageLabel}</p>
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      <div className="font-semibold text-slate-800">{regenerationFeedback.progressPercent}%</div>
                      <div>
                        {regenerationFeedback.progressPercent === 100
                          ? 'Estimated remaining 0:00'
                          : `Estimated remaining ${formatDuration(estimatedRemainingMs ?? 0)}`}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="h-3 overflow-hidden rounded-full bg-white/80">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${
                          regenerationFeedback.progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${regenerationFeedback.progressPercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Estimated progress based on encoder stages. Large source files can take longer.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Encoder feedback</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div>
                      Source:{' '}
                      <span className="font-medium text-slate-800">
                        {videoProcessing?.source?.width && videoProcessing?.source?.height
                          ? `${videoProcessing.source.width}×${videoProcessing.source.height}`
                          : 'Unknown'}
                      </span>
                    </div>
                    <div>
                      ffprobe:{' '}
                      <span className="font-medium text-slate-800">
                        {videoProcessing?.ffprobeAvailable ? 'available' : `missing (${videoProcessing?.ffprobeReason ?? 'unknown'})`}
                      </span>
                    </div>
                    <div>
                      ffmpeg:{' '}
                      <span className="font-medium text-slate-800">
                        {videoProcessing?.ffmpegAvailable ? 'available' : `missing (${videoProcessing?.ffmpegReason ?? 'unknown'})`}
                      </span>
                    </div>
                    <div>
                      Planned renditions:{' '}
                      <span className="font-medium text-slate-800">
                        {plannedRenditions.length ? plannedRenditions.map((target: any) => target.label).join(', ') : 'None'}
                      </span>
                    </div>
                    <div>
                      Generated:{' '}
                      <span className="font-medium text-slate-800">
                        {videoProcessing?.generatedCount ?? 0}
                      </span>
                    </div>
                    {videoProcessing?.noTargetsReason && (
                      <div className="text-amber-700">
                        No ladder generated: {String(videoProcessing.noTargetsReason).replace(/_/g, ' ')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Last run detail</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {renditionProcessing.length > 0 ? renditionProcessing.map((entry: any) => (
                      <div key={entry.label} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                        <span className="font-medium text-slate-800">{entry.label}</span>
                        <span className={entry.available ? 'text-emerald-700' : 'text-rose-700'}>
                          {entry.available ? 'generated' : (entry.reason ?? 'failed')}
                        </span>
                      </div>
                    )) : videoRenditionState.awaitingPublish ? (
                      <div className="text-slate-500">Waiting for the background worker to finish creating the creative version and renditions.</div>
                    ) : (
                      <div className="text-slate-500">No encoder run recorded yet.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Rendition</th>
                      <th className="px-4 py-3">Resolution</th>
                      <th className="px-4 py-3">Bitrate</th>
                      <th className="px-4 py-3">Codec</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Asset</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {videoRenditionState.renditions.map(rendition => (
                      <tr key={rendition.id}>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-800">{rendition.label}</span>
                            {rendition.isSource && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                Source
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {rendition.width && rendition.height ? `${rendition.width}×${rendition.height}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatVideoBitrate(rendition.bitrateKbps)}</td>
                        <td className="px-4 py-3 text-slate-600">{rendition.codec || '—'}</td>
                        <td className="px-4 py-3">{statusBadge(rendition.status)}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1 text-xs text-slate-500">
                            {rendition.publicUrl ? (
                              <a
                                href={rendition.publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-indigo-600 hover:text-indigo-700"
                              >
                                Open MP4
                              </a>
                            ) : (
                              <span>Not published</span>
                            )}
                            <div>{formatBytes(rendition.sizeBytes)}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <label className={`inline-flex items-center gap-3 text-xs font-medium ${
                            videoRenditionState.loading || rendition.status === 'processing' || rendition.status === 'failed'
                              ? 'cursor-not-allowed text-slate-400'
                              : 'cursor-pointer text-slate-700'
                          }`}>
                            <span>{rendition.status === 'active' ? 'On' : 'Off'}</span>
                            <span className="relative inline-flex items-center">
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={rendition.status === 'active'}
                                disabled={videoRenditionState.loading || rendition.status === 'processing' || rendition.status === 'failed'}
                                onChange={(event) => {
                                  void handleVideoRenditionStatusChange(
                                    rendition.id,
                                    event.target.checked ? 'active' : 'paused',
                                  );
                                }}
                              />
                              <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-500 peer-disabled:bg-slate-200" />
                              <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                            </span>
                          </label>
                        </td>
                      </tr>
                    ))}
                    {!videoRenditionState.loading && videoRenditionState.renditions.length === 0 && videoRenditionState.awaitingPublish && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                          Renditions are still being generated in the background. This table will populate after publish completes.
                        </td>
                      </tr>
                    )}
                    {!videoRenditionState.loading && videoRenditionState.renditions.length === 0 && !videoRenditionState.awaitingPublish && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                          No video renditions yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {variantState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Resolution management</h2>
                <p className="mt-1 text-sm text-slate-500">{variantState.creativeName}</p>
              </div>
              <button
                onClick={() => setVariantState(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Preset sizes</h3>
                    <p className="mt-1 text-xs text-slate-500">Seed the matrix with common display resolutions in one action.</p>
                  </div>
                  <button
                    onClick={() => void handleCreatePresetVariants(VARIANT_PRESETS)}
                    disabled={variantState.loading}
                    className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                  >
                    Add standard set
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {VARIANT_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => void handleCreatePresetVariants([preset])}
                      disabled={variantState.loading}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_120px_120px_auto]">
                <input
                  value={variantState.form.label}
                  onChange={event => setVariantState(current => current ? { ...current, form: { ...current.form, label: event.target.value } } : current)}
                  placeholder="300x250 · Mobile"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={variantState.form.width}
                  onChange={event => setVariantState(current => current ? { ...current, form: { ...current.form, width: event.target.value } } : current)}
                  placeholder="Width"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={variantState.form.height}
                  onChange={event => setVariantState(current => current ? { ...current, form: { ...current.form, height: event.target.value } } : current)}
                  placeholder="Height"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => void handleCreateVariant()}
                  disabled={variantState.loading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
                >
                  Add size
                </button>
              </div>

              {variantState.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {variantState.error}
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={variantState.variants.length > 0 && variantState.selectedVariantIds.length === variantState.variants.length}
                        onChange={toggleSelectAllVariants}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Select all
                    </label>
                    <span className="text-xs text-slate-500">
                      {variantState.selectedVariantIds.length} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleBulkVariantStatusChange('active')}
                      disabled={variantState.loading || variantState.selectedVariantIds.length === 0}
                      className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                    >
                      Activate selected
                    </button>
                    <button
                      onClick={() => void handleBulkVariantStatusChange('paused')}
                      disabled={variantState.loading || variantState.selectedVariantIds.length === 0}
                      className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                    >
                      Pause selected
                    </button>
                  </div>
                </div>
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="px-4 py-3">Variant</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Readiness</th>
                      <th className="px-4 py-3">Bindings</th>
                      <th className="px-4 py-3">Preview</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {variantState.variants.map(variant => (
                      <tr key={variant.id}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={variantState.selectedVariantIds.includes(variant.id)}
                            onChange={() => toggleVariantSelection(variant.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{variant.label}</td>
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
                              <a href={variant.publicUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:text-indigo-700">
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
                            <button
                              onClick={() => void handleVariantStatusChange(variant.id, 'paused')}
                              disabled={variantState.loading}
                              className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                            >
                              Pause
                            </button>
                          ) : (
                            <button
                              onClick={() => void handleVariantStatusChange(variant.id, 'active')}
                              disabled={variantState.loading}
                              className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              Activate
                            </button>
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
          </div>
        </div>
      )}
    </div>
  );
}
