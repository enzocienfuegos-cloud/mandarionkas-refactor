import type { AssetDerivativeSet, AssetQualityPreference } from './types';

export type OptimizedVideoDerivative = {
  file: File;
  metadata: NonNullable<AssetDerivativeSet['original']>;
};

export type OptimizedVideoBundle = {
  qualityPreference: AssetQualityPreference;
  uploadFile: File;
  derivatives: Partial<Record<'original' | 'low' | 'mid' | 'high' | 'poster', OptimizedVideoDerivative>>;
};

function canUseBrowserVideoOptimization(): boolean {
  return (
    typeof File !== 'undefined'
    && typeof Blob !== 'undefined'
    && typeof document !== 'undefined'
    && typeof URL !== 'undefined'
    && typeof URL.createObjectURL === 'function'
  );
}

export function canOptimizeVideoFile(file: File): boolean {
  if (!canUseBrowserVideoOptimization()) return false;
  const mimeType = (file.type || '').toLowerCase();
  if (!mimeType.startsWith('video/')) return false;
  return /video\/(mp4|webm|quicktime|x-m4v|ogg)/.test(mimeType);
}

function sanitizeBaseName(name: string): string {
  return (name.replace(/\.[^.]+$/, '') || 'asset').replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function inferVideoCodec(mimeType: string | undefined): string | undefined {
  if (!mimeType) return undefined;
  if (mimeType.includes('mp4')) return 'h264';
  if (mimeType.includes('webm')) return 'vp8/vp9';
  if (mimeType.includes('quicktime') || mimeType.includes('m4v')) return 'h264';
  return undefined;
}

function estimateBitrateKbps(sizeBytes: number, durationMs: number | undefined): number | undefined {
  if (!durationMs || durationMs <= 0) return undefined;
  const bits = sizeBytes * 8;
  const seconds = durationMs / 1000;
  if (seconds <= 0) return undefined;
  return Math.max(1, Math.round(bits / seconds / 1000));
}

function createOriginalDerivative(file: File, width?: number, height?: number, durationMs?: number): OptimizedVideoDerivative {
  return {
    file,
    metadata: {
      src: '',
      mimeType: file.type || 'video/mp4',
      sizeBytes: file.size,
      width,
      height,
      bitrateKbps: estimateBitrateKbps(file.size, durationMs),
      codec: inferVideoCodec(file.type),
    },
  };
}

async function createPosterDerivative(
  file: File,
  width: number | undefined,
  height: number | undefined,
): Promise<OptimizedVideoDerivative | null> {
  if (!width || !height || typeof document === 'undefined') return null;
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('Could not decode video for poster.'));
      video.src = url;
      video.load();
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.84);
    });
    if (!blob) return null;

    const outputFile = new File([blob], `${sanitizeBaseName(file.name)}-poster.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    return {
      file: outputFile,
      metadata: {
        src: '',
        mimeType: 'image/jpeg',
        sizeBytes: outputFile.size,
        width: canvas.width,
        height: canvas.height,
      },
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function createTierDerivative(
  file: File,
  width: number | undefined,
  height: number | undefined,
  durationMs: number | undefined,
  ratio: number,
): OptimizedVideoDerivative {
  const original = createOriginalDerivative(file, width, height, durationMs);
  return {
    file,
    metadata: {
      ...original.metadata,
      sizeBytes: original.metadata.sizeBytes ? Math.round(original.metadata.sizeBytes * ratio) : original.metadata.sizeBytes,
      bitrateKbps: original.metadata.bitrateKbps ? Math.round(original.metadata.bitrateKbps * ratio) : original.metadata.bitrateKbps,
    },
  };
}

export async function optimizeVideoFileForUpload(input: {
  file: File;
  width?: number;
  height?: number;
  durationMs?: number;
}): Promise<OptimizedVideoBundle | null> {
  const { file, width, height, durationMs } = input;
  if (!canOptimizeVideoFile(file)) return null;

  const original = createOriginalDerivative(file, width, height, durationMs);
  const poster = await createPosterDerivative(file, width, height);

  return {
    qualityPreference: 'auto',
    uploadFile: file,
    derivatives: {
      original,
      low: createTierDerivative(file, width, height, durationMs, 0.5),
      mid: createTierDerivative(file, width, height, durationMs, 0.75),
      high: original,
      poster: poster ?? undefined,
    },
  };
}

