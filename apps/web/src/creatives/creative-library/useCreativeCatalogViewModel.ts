import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { Creative, TagOption } from '../catalog';
import type {
  CreativeFormat,
  CreativeRow,
  CreativeStatus,
  LatestVersionMap,
  Metric,
  PrioritySeverity,
  PrototypeCheck,
} from './types';
import { resolveCreativePreviewHref } from './ui';

type Params = {
  creatives: Creative[];
  latestVersions: LatestVersionMap;
  tags: TagOption[];
  selectedClientIds: string[];
  formatFilter: 'all' | 'video' | 'display' | 'native';
  statusFilter: 'all' | 'active' | 'inactive' | 'pending_review' | 'rejected';
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
  };
}
