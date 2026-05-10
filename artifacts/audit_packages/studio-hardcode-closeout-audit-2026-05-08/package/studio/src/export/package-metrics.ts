import type { ExportAssetPlanEntry } from './assets';
import type { ExportBundle } from './bundle';

export type ExportPackageMetrics = {
  totalBytes: number;
  totalFiles: number;
  assetCount: number;
  remoteBundledAssetCount: number;
  inlineAssetCount: number;
  materializedAssetCount: number;
  htmlBytes: number;
  javascriptBytes: number;
  jsonBytes: number;
  binaryBytes: number;
};

function getFileByteSize(file: ExportBundle['files'][number]): number {
  return file.bytes?.length ?? new TextEncoder().encode(file.content ?? '').length;
}

export function buildExportPackageMetrics(
  bundle: ExportBundle,
  assetPlan: ExportAssetPlanEntry[],
): ExportPackageMetrics {
  return bundle.files.reduce<ExportPackageMetrics>((metrics, file) => {
    const nextBytes = getFileByteSize(file);
    const isAssetBinary = assetPlan.some((asset) => asset.packagingPath === file.path);

    if (file.path.endsWith('.html')) metrics.htmlBytes += nextBytes;
    else if (file.path.endsWith('.js')) metrics.javascriptBytes += nextBytes;
    else if (file.path.endsWith('.json')) metrics.jsonBytes += nextBytes;
    else if (isAssetBinary || file.bytes) metrics.binaryBytes += nextBytes;

    if (isAssetBinary) metrics.materializedAssetCount += 1;

    metrics.totalBytes += nextBytes;
    metrics.totalFiles += 1;
    return metrics;
  }, {
    totalBytes: 0,
    totalFiles: 0,
    assetCount: assetPlan.length,
    remoteBundledAssetCount: assetPlan.filter((asset) => asset.strategy === 'bundled-copy').length,
    inlineAssetCount: assetPlan.filter((asset) => asset.strategy === 'inline-data-uri').length,
    materializedAssetCount: 0,
    htmlBytes: 0,
    javascriptBytes: 0,
    jsonBytes: 0,
    binaryBytes: 0,
  });
}
