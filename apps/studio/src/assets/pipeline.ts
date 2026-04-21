import type { AssetAccessScope, AssetDraft, AssetKind, AssetSourceType, AssetStorageMode } from './types';

export type AssetUploadMetadataDraft = {
  name: string;
  kind: AssetKind;
  mimeType?: string;
  accessScope?: AssetAccessScope;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  posterSrc?: string;
  tags?: string[];
  fingerprint?: string;
  fontFamily?: string;
};

function normalizeAssetName(name: string | undefined, fallback: string): string {
  const trimmed = name?.trim();
  return trimmed || fallback;
}

function createFallbackHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return createFallbackHash(String(buffer.byteLength));
  const digest = await subtle.digest('SHA-256', buffer);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((item) => item.toString(16).padStart(2, '0')).join('');
}

async function hashText(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return createFallbackHash(value);
  const encoded = new TextEncoder().encode(value);
  return hashBuffer(encoded.buffer);
}

export function inferAssetKindFromUrl(url: string): AssetKind {
  const lower = url.toLowerCase();
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/.test(lower)) return 'video';
  if (/\.(png|jpg|jpeg|gif|webp|svg|avif)(\?|#|$)/.test(lower)) return 'image';
  if (/\.(ttf|otf|woff|woff2)(\?|#|$)/.test(lower)) return 'font';
  return 'other';
}

export function inferAssetKindFromMimeType(mimeType: string | undefined): AssetKind {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('font/') || /woff|truetype|opentype/.test(mimeType)) return 'font';
  return 'other';
}

function inferAssetKindFromFileName(fileName: string | undefined): AssetKind {
  if (!fileName) return 'other';
  return inferAssetKindFromUrl(fileName);
}

function inferMimeType(kind: AssetKind, mimeType: string | undefined): string {
  if (mimeType?.trim()) return mimeType;
  if (kind === 'image') return 'image/*';
  if (kind === 'video') return 'video/*';
  if (kind === 'font') return 'font/*';
  return 'application/octet-stream';
}

function guessNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    return lastSegment || parsed.hostname || 'Remote asset';
  } catch {
    return url.split('/').filter(Boolean).pop() || 'Remote asset';
  }
}

function measureImage(src: string): Promise<Pick<AssetUploadMetadataDraft, 'width' | 'height'>> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({});
      return;
    }
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
    image.onerror = () => resolve({});
    image.src = src;
  });
}

function measureVideo(src: string): Promise<Pick<AssetUploadMetadataDraft, 'width' | 'height' | 'durationMs' | 'posterSrc'>> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({});
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => resolve({
      width: video.videoWidth,
      height: video.videoHeight,
      durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined,
    });
    video.onerror = () => resolve({});
    video.src = src;
  });
}

async function extractVisualMetadata(kind: AssetKind, src: string): Promise<Pick<AssetUploadMetadataDraft, 'width' | 'height' | 'durationMs' | 'posterSrc'>> {
  try {
    if (kind === 'image') return await measureImage(src);
    if (kind === 'video') return await measureVideo(src);
  } catch {
    return {};
  }
  return {};
}

function normalizeUrl(url: string): string {
  return url.trim();
}

function createFilePreviewUrl(file: File): string | null {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

function revokeFilePreviewUrl(value: string | null): void {
  if (!value || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  try {
    URL.revokeObjectURL(value);
  } catch {
    // ignore revoke failures
  }
}

export async function createAssetDraftFromUrl(input: { url: string; name?: string; accessScope?: AssetDraft['accessScope']; mimeType?: string; tags?: string[]; folderId?: string; }): Promise<AssetDraft> {
  const originUrl = normalizeUrl(input.url);
  const kind = inferAssetKindFromUrl(originUrl);
  const metadata = await extractVisualMetadata(kind, originUrl);
  return {
    name: normalizeAssetName(input.name, guessNameFromUrl(originUrl)),
    kind,
    src: originUrl,
    publicUrl: originUrl,
    originUrl,
    mimeType: inferMimeType(kind, input.mimeType),
    fontFamily: kind === 'font' ? normalizeAssetName(input.name, guessNameFromUrl(originUrl)).replace(/\.[^.]+$/, '') : undefined,
    sourceType: 'url',
    storageMode: 'remote-url',
    accessScope: input.accessScope,
    tags: input.tags,
    folderId: input.folderId,
    fingerprint: await hashText(`url:${originUrl}|kind:${kind}`),
    ...metadata,
  };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Could not read file as data URL.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export async function createAssetUploadMetadataFromFile(input: { file: File; name?: string; accessScope?: AssetDraft['accessScope']; tags?: string[]; }): Promise<AssetUploadMetadataDraft> {
  const file = input.file;
  const kindFromMime = inferAssetKindFromMimeType(file.type);
  const kind = kindFromMime === 'other' ? inferAssetKindFromFileName(file.name) : kindFromMime;
  const previewUrl = createFilePreviewUrl(file);
  let metadata: Pick<AssetUploadMetadataDraft, 'width' | 'height' | 'durationMs' | 'posterSrc'> = {};
  try {
    metadata = await extractVisualMetadata(kind, previewUrl ?? (await readFileAsDataUrl(file)));
  } finally {
    revokeFilePreviewUrl(previewUrl);
  }
  return {
    name: normalizeAssetName(input.name, file.name || 'Uploaded asset'),
    kind,
    mimeType: inferMimeType(kind, file.type),
    accessScope: input.accessScope,
    sizeBytes: file.size,
    fontFamily: kind === 'font' ? normalizeAssetName(input.name, file.name || 'Uploaded font').replace(/\.[^.]+$/, '') : undefined,
    tags: input.tags,
    fingerprint: await hashBuffer(await file.arrayBuffer()),
    ...metadata,
  };
}

export function describeAssetSource(sourceType: AssetSourceType | undefined, storageMode: AssetStorageMode | undefined): string {
  const resolvedSource = sourceType ?? 'upload';
  const resolvedStorage = storageMode ?? (resolvedSource === 'url' ? 'remote-url' : 'object-storage');
  return `${resolvedSource} · ${resolvedStorage}`;
}
