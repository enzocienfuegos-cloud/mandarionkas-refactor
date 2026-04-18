import type { AssetDerivative, AssetDerivativeSet, AssetQualityPreference, AssetQualityTier } from './types';

type CanvasHandle = {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  toBlob: (mimeType: string, quality?: number) => Promise<Blob | null>;
};

type DerivativeSlot = AssetQualityTier | 'thumbnail';

export type OptimizedImageDerivative = {
  file: File;
  metadata: NonNullable<AssetDerivativeSet[AssetQualityTier]>;
};

export type OptimizedImageBundle = {
  qualityPreference: AssetQualityPreference;
  uploadTier: AssetQualityTier;
  uploadFile: File;
  derivatives: Partial<Record<DerivativeSlot | 'original', OptimizedImageDerivative>>;
};

type TierSpec = {
  maxDimension: number;
  quality: number;
  format: 'png' | 'jpeg' | 'webp';
  fileSuffix: string;
};

const IMAGE_TIER_SPECS: Record<DerivativeSlot | 'high-png', TierSpec> = {
  low: { maxDimension: 640, quality: 0.72, format: 'webp', fileSuffix: 'low' },
  mid: { maxDimension: 1280, quality: 0.84, format: 'webp', fileSuffix: 'mid' },
  high: { maxDimension: 1920, quality: 0.92, format: 'jpeg', fileSuffix: 'high' },
  'high-png': { maxDimension: 1920, quality: 1, format: 'png', fileSuffix: 'high' },
  thumbnail: { maxDimension: 320, quality: 0.72, format: 'webp', fileSuffix: 'thumb' },
};

function canUseBrowserImageOptimization(): boolean {
  return (
    typeof File !== 'undefined'
    && typeof Blob !== 'undefined'
    && (typeof createImageBitmap === 'function' || typeof Image !== 'undefined')
  );
}

export function canOptimizeImageFile(file: File): boolean {
  if (!canUseBrowserImageOptimization()) return false;
  const mimeType = (file.type || '').toLowerCase();
  if (!mimeType.startsWith('image/')) return false;
  return !mimeType.includes('svg') && !mimeType.includes('gif');
}

function sanitizeBaseName(name: string): string {
  return (name.replace(/\.[^.]+$/, '') || 'asset').replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function mimeTypeForSpec(spec: TierSpec): string {
  return spec.format === 'png' ? 'image/png' : spec.format === 'jpeg' ? 'image/jpeg' : 'image/webp';
}

function extensionForSpec(spec: TierSpec): string {
  return spec.format === 'png' ? 'png' : spec.format === 'jpeg' ? 'jpg' : 'webp';
}

async function createCanvas(width: number, height: number): Promise<CanvasHandle | null> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) return null;
    return {
      canvas,
      context,
      async toBlob(mimeType, quality) {
        return canvas.convertToBlob({ type: mimeType, quality });
      },
    };
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    return {
      canvas,
      context,
      async toBlob(mimeType, quality) {
        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), mimeType, quality);
        });
      },
    };
  }

  return null;
}

async function loadRasterSource(
  file: File,
): Promise<{ width: number; height: number; source: CanvasImageSource } | null> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
    };
  }

  if (typeof Image !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Could not decode image.'));
        element.src = url;
      });
      return {
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        source: image,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return null;
}

function scaleDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) return { width, height };
  const scale = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function renderDerivative(
  file: File,
  source: Awaited<ReturnType<typeof loadRasterSource>>,
  spec: TierSpec,
): Promise<OptimizedImageDerivative | null> {
  if (!source) return null;
  const dimensions = scaleDimensions(source.width, source.height, spec.maxDimension);
  const canvasHandle = await createCanvas(dimensions.width, dimensions.height);
  if (!canvasHandle) return null;

  const { context } = canvasHandle;
  context.clearRect(0, 0, dimensions.width, dimensions.height);
  context.drawImage(source.source, 0, 0, dimensions.width, dimensions.height);

  const mimeType = mimeTypeForSpec(spec);
  const blob = await canvasHandle.toBlob(mimeType, spec.quality);
  if (!blob) return null;

  const baseName = sanitizeBaseName(file.name);
  const outputFile = new File([blob], `${baseName}-${spec.fileSuffix}.${extensionForSpec(spec)}`, {
    type: mimeType,
    lastModified: Date.now(),
  });

  return {
    file: outputFile,
    metadata: {
      src: '',
      mimeType,
      sizeBytes: outputFile.size,
      width: dimensions.width,
      height: dimensions.height,
    },
  };
}

function createOriginalDerivative(file: File): OptimizedImageDerivative {
  return {
    file,
    metadata: {
      src: '',
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      width: undefined,
      height: undefined,
    },
  };
}

function chooseUploadDerivative(
  original: OptimizedImageDerivative,
  high: OptimizedImageDerivative | null,
): { tier: AssetQualityTier; derivative: OptimizedImageDerivative } {
  if (!high) return { tier: 'high', derivative: original };
  if (high.file.size <= original.file.size * 1.02) {
    return { tier: 'high', derivative: high };
  }
  return { tier: 'high', derivative: original };
}

export async function optimizeImageFileForUpload(file: File): Promise<OptimizedImageBundle | null> {
  if (!canOptimizeImageFile(file)) return null;
  const source = await loadRasterSource(file);
  if (!source) return null;

  const isPng = (file.type || '').toLowerCase() === 'image/png';
  const original = createOriginalDerivative(file);
  const low = await renderDerivative(file, source, IMAGE_TIER_SPECS.low);
  const mid = await renderDerivative(file, source, IMAGE_TIER_SPECS.mid);
  const high = await renderDerivative(file, source, isPng ? IMAGE_TIER_SPECS['high-png'] : IMAGE_TIER_SPECS.high);
  const thumbnail = await renderDerivative(file, source, IMAGE_TIER_SPECS.thumbnail);
  const upload = chooseUploadDerivative(original, high);

  return {
    qualityPreference: 'auto',
    uploadTier: upload.tier,
    uploadFile: upload.derivative.file,
    derivatives: {
      original,
      low: low ?? undefined,
      mid: mid ?? undefined,
      high: high ?? original,
      thumbnail: thumbnail ?? undefined,
    },
  };
}

export async function materializeDerivativeSetWithDataUrls(
  derivatives: Partial<Record<keyof AssetDerivativeSet, { file: File; metadata: AssetDerivative }>> | undefined,
): Promise<AssetDerivativeSet | undefined> {
  if (!derivatives) return undefined;

  const entries = await Promise.all(
    Object.entries(derivatives).map(async ([key, value]) => {
      if (!value) return [key, undefined] as const;
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
            return;
          }
          reject(new Error('Could not encode derivative.'));
        };
        reader.onerror = () => reject(reader.error ?? new Error('Could not encode derivative.'));
        reader.readAsDataURL(value.file);
      });
      return [key, { ...value.metadata, src }] as const;
    }),
  );

  const mapped = Object.fromEntries(entries) as AssetDerivativeSet;
  return Object.values(mapped).some(Boolean) ? mapped : undefined;
}
