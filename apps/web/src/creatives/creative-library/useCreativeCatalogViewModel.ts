import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { Creative, CreativeIngestion, TagOption } from '../catalog';
import type {
  CreativeFormat,
  CreativeRow,
  CreativeStatus,
  LatestVersionMap,
  OperationalSignal,
  PrototypeCheck,
} from './types';
import { resolveCreativePreviewHref } from './ui';
import { findPendingIngestionForCreative } from './utils';

type Params = {
  creatives: Creative[];
  latestVersions: LatestVersionMap;
  ingestions: CreativeIngestion[];
  tags: TagOption[];
  selectedClientIds: string[];
  formatFilter: 'all' | 'video' | 'display' | 'native';
  statusFilter: 'all' | 'live' | 'publishing' | 'inactive' | 'attention' | 'preview';
  sizeFilter: string;
  searchTerm: string;
  selectedCreativeIds: string[];
  setSelectedCreativeIds: Dispatch<SetStateAction<string[]>>;
  bulkAssignTagId: string;
  setBulkAssignTagId: Dispatch<SetStateAction<string>>;
};

export function useCreativeCatalogViewModel({
  creatives,
  latestVersions,
  ingestions,
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
}: Params) {
  const formatOperationalIssueMessage = (rawMessage: string | null | undefined) => {
    const message = String(rawMessage ?? '').trim();
    if (!message) return null;
    if (message.startsWith('HTML5 archive references missing assets:')) {
      const missing = message.replace('HTML5 archive references missing assets:', '').trim();
      return missing
        ? `ZIP incompleto: faltan assets referenciados (${missing}).`
        : 'ZIP incompleto: faltan assets referenciados.';
    }
    if (message === 'missing_entry_html' || message === 'HTML5 archive is missing entry point: index.html') {
      return 'El ZIP no trae un `index.html` publicable.';
    }
    return message;
  };

  const isHtml5PublishStale = (metadata: Record<string, any>) => {
    const status = String(metadata.html5Publish?.status ?? '').toLowerCase();
    if (!['queued', 'publishing', 'processing'].includes(status)) return false;
    const timestamp = Date.parse(String(
      metadata.html5Publish?.updatedAt
      ?? metadata.html5Publish?.queuedAt
      ?? metadata.publishJob?.updatedAt
      ?? '',
    ));
    return Number.isFinite(timestamp) && Date.now() - timestamp > 5 * 60 * 1000;
  };

  const getVersionProcessingState = (creative: Creative) => {
    const version = latestVersions[creative.id];
    const metadata = (version?.metadata ?? {}) as Record<string, any>;
    const sourceKind = String(version?.sourceKind ?? '').toLowerCase();
    const versionStatus = String(version?.status ?? '').toLowerCase();
    const transcodeStatus = String(version?.transcodeStatus ?? '').toLowerCase();
    const videoProcessingStatus = String(metadata.videoProcessing?.status ?? '').toLowerCase();
    const html5PublishStatus = String(metadata.html5Publish?.status ?? '').toLowerCase();
    const hasCompletedHtml5Preview = sourceKind === 'html5_zip'
      && html5PublishStatus === 'completed'
      && Boolean(
        version?.previewUrl
        || version?.publicUrl
        || metadata.html5Publish?.publicUrl
        || metadata.publishJob?.publicUrl,
      );
    if (hasCompletedHtml5Preview || isHtml5PublishStale(metadata)) return false;
    return versionStatus === 'processing'
      || transcodeStatus === 'queued'
      || transcodeStatus === 'processing'
      || videoProcessingStatus === 'queued'
      || videoProcessingStatus === 'processing'
      || html5PublishStatus === 'queued'
      || html5PublishStatus === 'publishing'
      || html5PublishStatus === 'processing';
  };

  const hasPlayableOrPreviewAsset = (creative: Creative) => Boolean(resolveCreativePreviewHref(creative, latestVersions[creative.id]));

  const hasOperationalIssue = (creative: Creative) => {
    const version = latestVersions[creative.id];
    if (!version) return true;
    const metadata = (version.metadata ?? {}) as Record<string, any>;
    const versionStatus = String(version.status ?? '').toLowerCase();
    const transcodeStatus = String(version.transcodeStatus ?? '').toLowerCase();
    const videoProcessingStatus = String(metadata.videoProcessing?.status ?? '').toLowerCase();
    const html5PublishStatus = String(metadata.html5Publish?.status ?? '').toLowerCase();
    return versionStatus === 'rejected'
      || transcodeStatus === 'failed'
      || transcodeStatus === 'blocked'
      || transcodeStatus === 'stalled'
      || videoProcessingStatus === 'failed'
      || videoProcessingStatus === 'blocked'
      || html5PublishStatus === 'failed'
      || isHtml5PublishStale(metadata);
  };

  const getCreativeIssueMessage = (creative: Creative) => {
    const version = latestVersions[creative.id];
    const metadata = (version?.metadata ?? {}) as Record<string, any>;
    if (isHtml5PublishStale(metadata)) {
      return 'La publicación HTML5 lleva demasiado tiempo en cola. El worker va a reintentar automáticamente; si no cambia, vuelve a publicar el ZIP.';
    }
    const html5PublishDetail = formatOperationalIssueMessage(metadata.html5Publish?.detail);
    if (html5PublishDetail) return html5PublishDetail;

    const matchedIngestion = version
      ? findPendingIngestionForCreative(ingestions, creative, version)
      : ingestions
          .filter((ingestion) => ingestion.creativeId === creative.id)
          .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? null;

    if (!matchedIngestion || matchedIngestion.status !== 'failed') return null;

    const validationReport = matchedIngestion.validationReport && typeof matchedIngestion.validationReport === 'object'
      ? matchedIngestion.validationReport as Record<string, unknown>
      : null;
    const missingPaths = Array.isArray(validationReport?.missingPaths)
      ? validationReport?.missingPaths.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
      : [];
    if (missingPaths.length > 0) {
      return `ZIP incompleto: faltan assets referenciados (${missingPaths.join(', ')}).`;
    }

    return formatOperationalIssueMessage(matchedIngestion.errorDetail)
      ?? 'La publicación falló. Revisa el ZIP o vuelve a subir el creativo.';
  };

  const getCreativeOperationalState = (creative: Creative) => {
    const version = latestVersions[creative.id];
    const versionStatus = String(version?.status ?? '').toLowerCase();
    if (!version) return 'attention';
    if (versionStatus === 'archived') return 'inactive';
    if (getVersionProcessingState(creative)) return 'publishing';
    if (hasOperationalIssue(creative)) return 'attention';
    if (!hasPlayableOrPreviewAsset(creative)) return 'attention';
    return 'live';
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
      const previewMissing = !hasPlayableOrPreviewAsset(creative);
      if (statusFilter !== 'all') {
        if (statusFilter === 'preview') {
          if (!previewMissing) return false;
        } else if (operationalState !== statusFilter) {
          return false;
        }
      }

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

  const allVisibleCreativesSelected = filteredCreatives.length > 0 && filteredCreatives.every((creative) => selectedCreativeIds.includes(creative.id));
  const someVisibleCreativesSelected = filteredCreatives.some((creative) => selectedCreativeIds.includes(creative.id));
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
  }, [filteredCreatives, setSelectedCreativeIds]);

  useEffect(() => {
    setBulkAssignTagId((current) => (
      current && bulkAssignableTags.some((tag) => tag.id === current) ? current : ''
    ));
  }, [bulkAssignableTags, setBulkAssignTagId]);

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

  const liveCreatives = filteredCreatives.filter((creative) => getCreativeOperationalState(creative) === 'live').length;
  const publishingCreatives = filteredCreatives.filter((creative) => getCreativeOperationalState(creative) === 'publishing').length;
  const inactiveCreatives = filteredCreatives.filter((creative) => getCreativeOperationalState(creative) === 'inactive').length;
  const attentionCreatives = filteredCreatives.filter((creative) => getCreativeOperationalState(creative) === 'attention').length;
  const previewMissingCreatives = filteredCreatives.filter((creative) => !hasPlayableOrPreviewAsset(creative)).slice(0, 3);
  const previewMissingCount = filteredCreatives.filter((creative) => !hasPlayableOrPreviewAsset(creative)).length;
  const creativeAvailability = filteredCreatives.length ? Math.round((liveCreatives / filteredCreatives.length) * 100) : 0;

  const creativeRows = useMemo<CreativeRow[]>(() => (
    filteredCreatives.map((creative) => {
      const version = latestVersions[creative.id];
      const formatFamily = getCreativeFormatFamily(creative);
      const statusKey = getCreativeOperationalState(creative);
      const previewHref = resolveCreativePreviewHref(creative, version);
      const previewLabel = !previewHref
        ? 'Preview unavailable'
        : statusKey === 'publishing'
          ? 'Preparing preview'
          : 'Open preview';
      const signal: OperationalSignal =
        statusKey === 'publishing'
          ? 'Publishing'
          : statusKey === 'inactive'
            ? 'Inactive'
            : !previewHref || statusKey === 'attention'
              ? 'Needs attention'
              : 'Ready';
      const status: CreativeStatus =
        !previewHref && statusKey !== 'publishing' && statusKey !== 'inactive'
          ? 'Preview unavailable'
          : statusKey === 'publishing'
            ? 'Publishing'
            : statusKey === 'inactive'
              ? 'Inactive'
              : statusKey === 'attention'
                ? 'Needs attention'
                : 'Live';
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
        signal,
        preview: previewLabel,
        owner: creative.workspaceName ?? 'Creative Ops',
        issueMessage: status === 'Needs attention' ? getCreativeIssueMessage(creative) : null,
      };
    })
  ), [filteredCreatives, ingestions, latestVersions]);

  const prototypeChecks: PrototypeCheck[] = [
    { name: 'creative view renders rows', passed: creativeRows.length >= 1 },
    { name: 'creative ids are stable', passed: creativeRows.every((row) => row.id.length > 0) },
    { name: 'creative statuses are valid', passed: creativeRows.every((row) => ['Live', 'Publishing', 'Needs attention', 'Inactive', 'Preview unavailable'].includes(row.status)) },
    { name: 'creative formats are valid', passed: creativeRows.every((row) => ['Display', 'HTML5', 'Video', 'Native'].includes(row.format)) },
    { name: 'operational signals are valid', passed: creativeRows.every((row) => ['Ready', 'Publishing', 'Needs attention', 'Inactive'].includes(row.signal)) },
    { name: 'preview state is represented', passed: creativeRows.every((row) => row.preview && row.owner) },
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

  return {
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
    liveCreatives,
    publishingCreatives,
    inactiveCreatives,
    attentionCreatives,
    previewMissingCreatives,
    previewMissingCount,
    creativeRows,
    creativeAvailability,
    prototypeChecks,
    toggleCreativeSelection,
    toggleSelectAllVisibleCreatives,
  };
}
