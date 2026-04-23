export type CreativeFormat = 'vast_video' | 'display' | 'native';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'draft' | 'pending_review';
export type SourceKind = 'legacy' | 'studio_export' | 'html5_zip' | 'video_mp4' | 'image_upload' | 'native_upload' | 'vast_wrapper';

export interface Creative {
  id: string;
  name: string;
  format: CreativeFormat;
  approvalStatus: ApprovalStatus;
  thumbnailUrl?: string;
  previewUrl?: string;
  createdAt: string;
}

export interface CreativeVersion {
  id: string;
  creativeId: string;
  versionNumber: number;
  sourceKind: SourceKind;
  servingFormat: string;
  status: ApprovalStatus;
  publicUrl?: string;
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
}

export interface TagOption {
  id: string;
  name: string;
  format: 'VAST' | 'display' | 'native';
  status: 'active' | 'paused' | 'archived' | 'draft';
}

export interface CreativeIngestion {
  id: string;
  sourceKind: 'html5_zip' | 'video_mp4';
  status: 'uploaded' | 'processing' | 'validated' | 'failed' | 'published';
  originalFilename: string;
  mimeType?: string;
  sizeBytes?: number;
  publicUrl?: string;
  errorDetail?: string;
  creativeId?: string | null;
  creativeVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
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
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function loadCreatives(): Promise<Creative[]> {
  const payload = await fetchJson<{ creatives: Creative[] }>('/v1/creatives');
  return payload.creatives ?? [];
}

export async function loadCreativeVersions(creativeId: string): Promise<CreativeVersion[]> {
  const payload = await fetchJson<{ versions: CreativeVersion[] }>(`/v1/creatives/${creativeId}/versions`);
  return payload.versions ?? [];
}

export async function loadCreativesWithLatestVersion() {
  const creatives = await loadCreatives();
  const versionPairs = await Promise.all(
    creatives.map(async creative => {
      const versions = await loadCreativeVersions(creative.id);
      return [creative.id, versions[0] ?? null] as const;
    }),
  );
  return {
    creatives,
    latestVersions: Object.fromEntries(versionPairs),
  };
}

export async function loadCreativeIngestions(): Promise<CreativeIngestion[]> {
  const payload = await fetchJson<{ ingestions: CreativeIngestion[] }>('/v1/creative-ingestions');
  return payload.ingestions ?? [];
}

export async function loadTags(): Promise<TagOption[]> {
  const payload = await fetchJson<{ tags: TagOption[] }>('/v1/tags');
  return payload.tags ?? [];
}

export async function submitCreativeVersion(versionId: string) {
  return fetchJson<{ creativeVersion: CreativeVersion }>(`/v1/creative-versions/${versionId}/submit`, {
    method: 'POST',
  });
}

export async function loadPendingReviewVersions(): Promise<CreativeVersion[]> {
  const payload = await fetchJson<{ creativeVersions: CreativeVersion[] }>('/v1/creative-versions/pending-review');
  return payload.creativeVersions ?? [];
}

export async function approveCreativeVersion(versionId: string, notes?: string) {
  return fetchJson<{ creativeVersion: CreativeVersion }>(`/v1/creative-versions/${versionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function rejectCreativeVersion(versionId: string, reason: string) {
  return fetchJson<{ creativeVersion: CreativeVersion }>(`/v1/creative-versions/${versionId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function createCreativeIngestionUpload(input: {
  sourceKind: 'html5_zip' | 'video_mp4';
  file: File;
  name?: string;
}) {
  return fetchJson<{
    ingestion: CreativeIngestion;
    upload: { ingestionId: string; storageKey: string; uploadUrl: string; publicUrl?: string };
  }>('/v1/creative-ingestions/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      sourceKind: input.sourceKind,
      filename: input.file.name,
      mimeType: input.file.type || undefined,
      sizeBytes: input.file.size,
      name: input.name,
    }),
  });
}

export async function uploadFileToSignedUrl(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: file.type ? { 'Content-Type': file.type } : undefined,
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
}

export async function completeCreativeIngestion(ingestionId: string, input: {
  file: File;
  publicUrl?: string;
  storageKey?: string;
  name?: string;
}) {
  return fetchJson<{ ingestion: CreativeIngestion }>(`/v1/creative-ingestions/${ingestionId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      filename: input.file.name,
      mimeType: input.file.type || undefined,
      sizeBytes: input.file.size,
      publicUrl: input.publicUrl,
      storageKey: input.storageKey,
      name: input.name,
    }),
  });
}

export async function publishCreativeIngestion(ingestionId: string, input: {
  name?: string;
}) {
  return fetchJson<{
    ingestion: CreativeIngestion;
    creative: Creative;
    creativeVersion: CreativeVersion;
  }>(`/v1/creative-ingestions/${ingestionId}/publish`, {
    method: 'POST',
    body: JSON.stringify({ name: input.name }),
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
