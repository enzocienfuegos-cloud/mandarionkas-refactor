import type { StudioState } from '../domain/document/types';
import { buildExportAssetPlan } from './assets';

export type ExportSizeSetManifest = {
  documentId: string;
  documentName: string;
  exportedAt: string;
  targetChannel: StudioState['document']['metadata']['release']['targetChannel'];
  variantCount: number;
  sharedAssetCount: number;
  sharedAssets: Array<{
    sourceUrl: string;
    kind: string;
    path: string;
    fileName: string;
    variantCount: number;
  }>;
  variants: Array<{
    id: string;
    label: string;
    slug: string;
    width: number;
    height: number;
    isMaster: boolean;
    path: string;
    fileCount: number;
  }>;
};

export type SharedAssetRecord = {
  sourceUrl: string;
  kind: string;
  fileName: string;
  packagingPath: string;
  variantCount: number;
};

export function buildSharedAssetEntries(sharedAssets: SharedAssetRecord[]): ReturnType<typeof buildExportAssetPlan> {
  return sharedAssets.map((asset) => ({
    id: asset.sourceUrl,
    widgetId: 'shared',
    kind: asset.kind as ReturnType<typeof buildExportAssetPlan>[number]['kind'],
    sourceUrl: asset.sourceUrl,
    packagingPath: asset.packagingPath,
    fileName: asset.fileName,
    strategy: asset.sourceUrl.startsWith('data:') ? 'inline-data-uri' : 'bundled-copy',
  }));
}

export function buildSizeSetManifest(
  state: StudioState,
  sharedAssets: SharedAssetRecord[],
  variantBundles: Array<{
    variant: StudioState['document']['canvasVariants'][number];
    slug: string;
    bundle: { files: Array<unknown> };
  }>,
): ExportSizeSetManifest {
  return {
    documentId: state.document.id,
    documentName: state.document.name,
    exportedAt: new Date().toISOString(),
    targetChannel: state.document.metadata.release.targetChannel,
    variantCount: variantBundles.length,
    sharedAssetCount: sharedAssets.length,
    sharedAssets: sharedAssets.map((asset) => ({
      sourceUrl: asset.sourceUrl,
      kind: asset.kind,
      path: `bundle/${asset.packagingPath}`,
      fileName: asset.fileName,
      variantCount: asset.variantCount,
    })),
    variants: variantBundles.map(({ variant, slug, bundle }) => ({
      id: variant.id,
      label: variant.label,
      slug,
      width: variant.width,
      height: variant.height,
      isMaster: variant.isMaster,
      path: `bundle/${slug}`,
      fileCount: bundle.files.length,
    })),
  };
}
