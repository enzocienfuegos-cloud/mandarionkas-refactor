export type CreativeFormat = 'vast_video' | 'display' | 'native';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'draft' | 'pending_review';
export type SourceKind = 'legacy' | 'studio_export' | 'html5_zip' | 'video_mp4' | 'image_upload' | 'native_upload' | 'vast_wrapper';

export interface Creative {
  id: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  name: string;
  format: CreativeFormat;
  approvalStatus: ApprovalStatus;
  clickUrl?: string | null;
  thumbnailUrl?: string;
  previewUrl?: string;
  createdAt: string;
  latestVersion?: CreativeVersion;
}

export interface CreativeVersion {
  id: string;
  creativeId: string;
  versionNumber: number;
  sourceKind: SourceKind;
  servingFormat: string;
  status: ApprovalStatus;
  publicUrl?: string;
  previewUrl?: string;
  entryPath?: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  fileSize?: number | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  creativeName?: string;
  // Transcode job state — populated by GET /v1/creative-versions/:id
  transcodeStatus?: string | null;
  transcodeJob?: Record<string, unknown> | null;
}

export interface CreativeArtifact {
  id: string;
  creativeVersionId: string;
  kind: string;
  storageKey?: string;
  publicUrl?: string;
  mimeType?: string;
  sizeBytes?: number | null;
  checksum?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreativeSizeVariant {
  id: string;
  creativeVersionId: string;
  label: string;
  width: number;
  height: number;
  status: 'draft' | 'active' | 'paused' | 'archived';
  publicUrl?: string;
  artifactId?: string | null;
  metadata?: Record<string, unknown>;
  bindingCount?: number;
  activeBindingCount?: number;
  tagNames?: string[];
  totalImpressions?: number;
  totalClicks?: number;
  impressions7d?: number;
  clicks7d?: number;
  ctr?: number;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface VideoRendition {
  id: string;
  creativeVersionId: string;
  artifactId?: string | null;
  label: string;
  width?: number | null;
  height?: number | null;
  bitrateKbps?: number | null;
  codec?: string;
  mimeType?: string;
  status: 'draft' | 'queued' | 'processing' | 'active' | 'paused' | 'archived' | 'failed' | 'unavailable';
  isSource?: boolean;
  sortOrder?: number;
  publicUrl?: string;
  storageKey?: string;
  sizeBytes?: number | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface TagOption {
  id: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  name: string;
  format: 'VAST' | 'display' | 'native';
  status: 'active' | 'paused' | 'archived' | 'draft';
}

export interface TagBinding {
  id: string;
  tagId: string;
  creativeId?: string;
  creativeVersionId: string;
  creativeSizeVariantId?: string | null;
  status: 'draft' | 'active' | 'paused' | 'archived';
  weight: number;
  startAt?: string | null;
  endAt?: string | null;
  createdAt: string;
  updatedAt: string;
  creativeName: string;
  creativeClickUrl?: string | null;
  creativeVersionStatus: string;
  sourceKind: SourceKind | string;
  servingFormat: string;
  publicUrl?: string;
  entryPath?: string;
  variantLabel?: string;
  variantWidth?: number | null;
  variantHeight?: number | null;
  variantStatus?: string;
}

export interface CreativeIngestion {
  id: string;
  sourceKind: 'html5_zip' | 'video_mp4';
  status: 'pending_upload' | 'uploaded' | 'processing' | 'validated' | 'failed' | 'published';
  originalFilename: string;
  mimeType?: string;
  sizeBytes?: number;
  publicUrl?: string;
  metadata?: Record<string, unknown>;
  validationReport?: Record<string, unknown>;
  errorCode?: string;
  errorDetail?: string;
  creativeId?: string | null;
  creativeVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

function normalizeApiBaseUrl(value: string) {
  return value.replace(/\/+$/, '').replace(/\/v1$/, '');
}

function resolveApiUrl(path: string) {
  const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '');
  if (!apiBaseUrl || !path.startsWith('/')) return path;
  return `${apiBaseUrl}${path}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const requestId = payload && typeof payload === 'object' ? payload.requestId ?? payload.request_id ?? null : null;
    const message = payload && typeof payload === 'object'
      ? payload.message ?? payload.error ?? null
      : null;
    const suffix = requestId ? ` (ref ${requestId})` : '';
    throw new Error(message ? message : `Request failed (${response.status})${suffix}`);
  }
  return response.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

export async function loadCreatives(input: {
  scope?: 'all';
  workspaceId?: string;
  limit?: number;
  search?: string;
} = {}): Promise<Creative[]> {
  const payload = await fetchJson<{ creatives: Creative[] }>(`/v1/creatives${buildQuery({
    scope: input.scope,
    workspaceId: input.workspaceId,
    limit: input.limit,
    search: input.search,
    includeLatestVersion: '1',
  })}`);
  return payload.creatives ?? [];
}

export async function loadCreativeVersions(creativeId: string): Promise<CreativeVersion[]> {
  const payload = await fetchJson<{ versions: CreativeVersion[] }>(`/v1/creatives/${creativeId}/versions`);
  return payload.versions ?? [];
}

export async function loadCreativeVersionDetail(versionId: string): Promise<{
  creativeVersion: CreativeVersion;
  artifacts: CreativeArtifact[];
  variants: CreativeSizeVariant[];
  videoRenditions: VideoRendition[];
}> {
  const payload = await fetchJson<{
    creativeVersion: CreativeVersion;
    artifacts: CreativeArtifact[];
    variants: CreativeSizeVariant[];
    videoRenditions: VideoRendition[];
    transcodeStatus?: string | null;
    transcodeJob?: Record<string, unknown> | null;
  }>(`/v1/creative-versions/${versionId}`);
  return {
    creativeVersion: {
      ...payload.creativeVersion,
      transcodeStatus: (payload as any).transcodeStatus ?? null,
      transcodeJob: (payload as any).transcodeJob ?? null,
    },
    artifacts: payload.artifacts ?? [],
    variants: payload.variants ?? [],
    videoRenditions: payload.videoRenditions ?? [],
  };
}

export async function updateCreativeVersionById(input: {
  creativeVersionId: string;
  status?: 'draft' | 'processing' | 'pending_review' | 'approved' | 'rejected' | 'archived';
  metadata?: Record<string, unknown>;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
}) {
  return fetchJson<{ creativeVersion: CreativeVersion }>(`/v1/creative-versions/${input.creativeVersionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: input.status,
      metadata: input.metadata,
      reviewedBy: input.reviewedBy,
      reviewedAt: input.reviewedAt,
      reviewNotes: input.reviewNotes,
    }),
  });
}

export async function loadCreativeSizeVariants(versionId: string): Promise<CreativeSizeVariant[]> {
  const payload = await fetchJson<{ variants: CreativeSizeVariant[] }>(`/v1/creative-versions/${versionId}/variants`);
  return payload.variants ?? [];
}

export async function loadVideoRenditions(versionId: string): Promise<VideoRendition[]> {
  const payload = await fetchJson<{ renditions: VideoRendition[] }>(`/v1/creative-versions/${versionId}/video-renditions`);
  return payload.renditions ?? [];
}

export async function updateVideoRenditionById(input: {
  renditionId: string;
  status?: 'draft' | 'processing' | 'active' | 'paused' | 'archived' | 'failed';
  label?: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}) {
  return fetchJson<{ rendition: VideoRendition }>(`/v1/video-renditions/${input.renditionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: input.status,
      label: input.label,
      sortOrder: input.sortOrder,
      metadata: input.metadata,
    }),
  });
}

export async function regenerateVideoRenditions(versionId: string): Promise<VideoRendition[]> {
  const payload = await fetchJson<{ renditions: VideoRendition[] }>(`/v1/creative-versions/${versionId}/video-renditions/regenerate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return payload.renditions ?? [];
}

export async function loadCreativesWithLatestVersion(input: {
  scope?: 'all';
  workspaceId?: string;
  limit?: number;
  search?: string;
} = {}) {
  const creatives = await loadCreatives(input);
  return {
    creatives,
    latestVersions: Object.fromEntries(
      creatives.map(creative => [creative.id, creative.latestVersion ?? null]),
    ),
  };
}

export async function loadCreativeIngestions(): Promise<CreativeIngestion[]> {
  const payload = await fetchJson<{ ingestions: CreativeIngestion[] }>('/v1/creative-ingestions');
  return payload.ingestions ?? [];
}

export async function loadCreativeIngestion(ingestionId: string, input: { workspaceId?: string } = {}) {
  const payload = await fetchJson<{ ingestion: CreativeIngestion }>(
    `/v1/creative-ingestions/${ingestionId}${buildQuery({
      workspaceId: input.workspaceId,
    })}`,
  );
  return payload.ingestion;
}

export async function loadTags(input: {
  scope?: 'all';
  workspaceId?: string;
  campaignId?: string;
  limit?: number;
  search?: string;
} = {}): Promise<TagOption[]> {
  const payload = await fetchJson<{ tags: TagOption[] }>(`/v1/tags${buildQuery({
    scope: input.scope,
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    limit: input.limit,
    search: input.search,
  })}`);
  return payload.tags ?? [];
}

export async function createTag(input: {
  workspaceId?: string;
  name: string;
  format: 'VAST' | 'display' | 'native';
  status?: 'active' | 'paused' | 'archived' | 'draft';
  campaignId?: string | null;
  servingWidth?: number | null;
  servingHeight?: number | null;
  trackerType?: 'click' | 'impression' | null;
  clickUrl?: string | null;
}): Promise<TagOption | null> {
  const payload = await fetchJson<{ tag?: TagOption }>('/v1/tags', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: input.workspaceId ?? null,
      name: input.name,
      format: input.format,
      status: input.status ?? 'draft',
      campaignId: input.campaignId ?? null,
      servingWidth: input.servingWidth ?? null,
      servingHeight: input.servingHeight ?? null,
      trackerType: input.trackerType ?? null,
      clickUrl: input.clickUrl ?? null,
    }),
  });
  return payload.tag ?? null;
}

export async function loadTagBindings(tagId: string): Promise<TagBinding[]> {
  const payload = await fetchJson<{ bindings: TagBinding[] }>(`/v1/tags/${tagId}/bindings`);
  return payload.bindings ?? [];
}

export async function createCreativeIngestionUpload(input: {
  workspaceId?: string;
  sourceKind: 'html5_zip' | 'video_mp4';
  file: File;
  name?: string;
  clickUrl?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}) {
  return fetchJson<{
    ingestion: CreativeIngestion;
    upload: {
      ingestionId: string;
      storageKey: string;
      publicUrl?: string;
      presignedUrl: string | null;
      presignedMethod: 'PUT';
      presignedExpiresAt: string | null;
      proxyUrl: string;
      proxyMethod: 'POST';
      uploadUrl: string;
      uploadMethod?: string;
    };
  }>('/v1/creative-ingestions/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: input.workspaceId ?? null,
      sourceKind: input.sourceKind,
      filename: input.file.name,
      mimeType: input.file.type || undefined,
      sizeBytes: input.file.size,
      name: input.name,
      clickUrl: input.clickUrl ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      durationMs: input.durationMs ?? null,
    }),
  });
}

export async function uploadFileToSignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: { loadedBytes: number; totalBytes: number; percent: number }) => void,
) {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl, true);
    // Keep the presigned upload request "simple" so browsers do not trigger
    // a preflight against the R2 object endpoint. The creative ingestion flow
    // persists mimeType separately when we complete the upload.
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const loadedBytes = event.loaded;
      const totalBytes = event.total || file.size || 0;
      const percent = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
      onProgress?.({ loadedBytes, totalBytes, percent });
    };
    request.onerror = () => reject(new Error('Upload failed'));
    request.onabort = () => reject(new Error('Upload canceled'));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.({ loadedBytes: file.size, totalBytes: file.size, percent: 100 });
        resolve();
        return;
      }
      reject(new Error(`Upload failed (${request.status})`));
    };
    request.send(file);
  });
}

export async function uploadFileViaApiProxy(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: { loadedBytes: number; totalBytes: number; percent: number }) => void,
) {
  const resolvedUrl = resolveApiUrl(uploadUrl);
  console.info('[upload] step 3: resolved upload URL', {
    uploadUrl,
    resolvedUrl,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
  });

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(new Error('Upload timeout')), 60_000);

  try {
    onProgress?.({ loadedBytes: 0, totalBytes: file.size, percent: 0 });
    const response = await fetch(resolvedUrl, {
      method: 'POST',
      body: file,
      credentials: 'include',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      signal: controller.signal,
    });

    console.info('[upload] step 4: proxy returned', {
      status: response.status,
      ok: response.ok,
      type: response.type,
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      throw new Error(`Upload failed (${response.status})${responseText ? `: ${responseText.slice(0, 500)}` : ''}`);
    }

    onProgress?.({ loadedBytes: file.size, totalBytes: file.size, percent: 100 });
  } catch (error) {
    console.error('[upload] proxy request failed', error);
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function completeCreativeIngestion(ingestionId: string, input: {
  workspaceId?: string;
  file: File;
  publicUrl?: string;
  storageKey?: string;
  name?: string;
  clickUrl?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}) {
  return fetchJson<{ ingestion: CreativeIngestion }>(`/v1/creative-ingestions/${ingestionId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: input.workspaceId ?? null,
      filename: input.file.name,
      mimeType: input.file.type || undefined,
      sizeBytes: input.file.size,
      publicUrl: input.publicUrl,
      storageKey: input.storageKey,
      name: input.name,
      clickUrl: input.clickUrl ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      durationMs: input.durationMs ?? null,
    }),
  });
}

export async function publishCreativeIngestion(ingestionId: string, input: {
  workspaceId?: string;
  name?: string;
  clickUrl?: string | null;
}) {
  return fetchJson<{
    ingestion: CreativeIngestion;
    creative?: Creative;
    creativeVersion?: CreativeVersion;
    queued?: boolean;
    processing?: boolean;
    jobId?: string;
  }>(`/v1/creative-ingestions/${ingestionId}/publish`, {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: input.workspaceId ?? null,
      name: input.name,
      clickUrl: input.clickUrl ?? null,
    }),
  });
}

export async function assignCreativeVersionToTag(input: {
  creativeVersionId: string;
  tagId: string;
  weight?: number;
  status?: 'draft' | 'active' | 'paused' | 'archived';
}) {
  return fetchJson<{ binding: { id: string } }>(`/v1/creative-versions/${input.creativeVersionId}/assign/${input.tagId}`, {
    method: 'POST',
    body: JSON.stringify({
      weight: input.weight ?? 1,
      status: input.status ?? 'active',
    }),
  });
}

export async function deleteCreativeById(creativeId: string) {
  const response = await fetch(`/v1/creatives/${creativeId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const requestId = payload && typeof payload === 'object' ? payload.requestId ?? payload.request_id ?? null : null;
    const message = payload && typeof payload === 'object'
      ? payload.message ?? payload.error ?? null
      : null;
    const suffix = requestId ? ` (ref ${requestId})` : '';
    throw new Error(message ? message : `Request failed (${response.status})${suffix}`);
  }
}

export async function updateCreativeById(input: {
  creativeId: string;
  clickUrl?: string | null;
  name?: string;
}) {
  return fetchJson<{ creative: Creative }>(`/v1/creatives/${input.creativeId}`, {
    method: 'PUT',
    body: JSON.stringify({
      clickUrl: input.clickUrl,
      name: input.name,
    }),
  });
}

export async function createCreativeSizeVariant(input: {
  creativeVersionId: string;
  label?: string;
  width: number;
  height: number;
  status?: 'draft' | 'active' | 'paused' | 'archived';
  publicUrl?: string;
  artifactId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return fetchJson<{ variant: CreativeSizeVariant }>(`/v1/creative-versions/${input.creativeVersionId}/variants`, {
    method: 'POST',
    body: JSON.stringify({
      label: input.label,
      width: input.width,
      height: input.height,
      status: input.status,
      publicUrl: input.publicUrl,
      artifactId: input.artifactId,
      metadata: input.metadata,
    }),
  });
}

export async function createCreativeSizeVariantsBulk(input: {
  creativeVersionId: string;
  variants: Array<{
    label?: string;
    width: number;
    height: number;
    status?: 'draft' | 'active' | 'paused' | 'archived';
    publicUrl?: string;
    artifactId?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  status?: 'draft' | 'active' | 'paused' | 'archived';
  publicUrl?: string;
}) {
  return fetchJson<{ created: CreativeSizeVariant[]; variants: CreativeSizeVariant[]; skippedCount: number }>(
    `/v1/creative-versions/${input.creativeVersionId}/variants/bulk`,
    {
      method: 'POST',
      body: JSON.stringify({
        variants: input.variants,
        status: input.status,
        publicUrl: input.publicUrl,
      }),
    },
  );
}

export async function updateCreativeSizeVariant(input: {
  variantId: string;
  label?: string;
  width?: number;
  height?: number;
  status?: 'draft' | 'active' | 'paused' | 'archived';
  publicUrl?: string;
  artifactId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return fetchJson<{ variant: CreativeSizeVariant }>(`/v1/creative-variants/${input.variantId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      label: input.label,
      width: input.width,
      height: input.height,
      status: input.status,
      publicUrl: input.publicUrl,
      artifactId: input.artifactId,
      metadata: input.metadata,
    }),
  });
}

export async function updateCreativeSizeVariantsBulkStatus(input: {
  creativeVersionId: string;
  variantIds: string[];
  status: 'draft' | 'active' | 'paused' | 'archived';
}) {
  return fetchJson<{ variants: CreativeSizeVariant[] }>(`/v1/creative-versions/${input.creativeVersionId}/variants/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      variantIds: input.variantIds,
      status: input.status,
    }),
  });
}

export async function assignCreativeSizeVariantToTag(input: {
  creativeSizeVariantId: string;
  tagId: string;
  weight?: number;
  status?: 'draft' | 'active' | 'paused' | 'archived';
}) {
  return fetchJson<{ binding: { id: string } }>(`/v1/creative-variants/${input.creativeSizeVariantId}/assign/${input.tagId}`, {
    method: 'POST',
    body: JSON.stringify({
      weight: input.weight ?? 1,
      status: input.status ?? 'active',
    }),
  });
}

export async function updateTagBinding(input: {
  tagId: string;
  bindingId: string;
  status?: 'draft' | 'active' | 'paused' | 'archived';
  weight?: number;
}) {
  return fetchJson<{ binding: TagBinding }>(`/v1/tags/${input.tagId}/bindings/${input.bindingId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: input.status,
      weight: input.weight,
    }),
  });
}
