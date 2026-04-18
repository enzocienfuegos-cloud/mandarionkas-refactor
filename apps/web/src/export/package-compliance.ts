import type { ExportAssetPlanEntry } from './assets';
import type { ExportBundle } from './bundle';
import { buildExportPackageMetrics } from './package-metrics';
import type { ExportExitConfig, ExportPackagingPlan } from './packaging';

export type ExportPackageComplianceIssue = {
  level: 'error' | 'warning';
  code: string;
  message: string;
  targetId?: string;
  scope: 'bundle' | 'entry' | 'runtime' | 'asset' | 'exit' | 'packaging';
};

function getTotalBundleBytes(bundle: ExportBundle): number {
  const encoder = new TextEncoder();
  return bundle.files.reduce((sum, file) => sum + (file.bytes?.length ?? encoder.encode(file.content ?? '').length), 0);
}

export function validateExportPackage(
  bundle: ExportBundle,
  packagingPlan: ExportPackagingPlan,
  exitConfig: ExportExitConfig,
  assetPlan: ExportAssetPlanEntry[],
): ExportPackageComplianceIssue[] {
  const issues: ExportPackageComplianceIssue[] = [];
  const filePaths = bundle.files.map((file) => file.path);
  const duplicates = filePaths.filter((path, index) => filePaths.indexOf(path) !== index);
  const htmlFiles = filePaths.filter((path) => path.endsWith('.html'));
  const totalBytes = getTotalBundleBytes(bundle);
  const bundledAssetCount = assetPlan.filter((asset) => asset.strategy === 'bundled-copy').length;
  const remoteReferencedAssetCount = assetPlan.filter((asset) => asset.strategy === 'external-reference' && /^https?:\/\//i.test(asset.src)).length;
  const materializedAssets = assetPlan.filter((asset) => filePaths.includes(asset.packagingPath));
  const packageMetrics = buildExportPackageMetrics(bundle, assetPlan);
  const clickTagChannel = bundle.channel === 'google-display' || bundle.channel === 'gam-html5';
  const mraidChannel = bundle.channel === 'mraid';

  if (!bundle.files.length) {
    issues.push({
      level: 'error',
      code: 'bundle.empty',
      scope: 'bundle',
      message: 'Export bundle has no files.',
    });
    return issues;
  }

  duplicates.forEach((path) => {
    issues.push({
      level: 'error',
      code: 'bundle.duplicate-file',
      scope: 'bundle',
      targetId: path,
      message: `Export bundle contains duplicate path "${path}".`,
    });
  });

  packagingPlan.emittedFiles.forEach((path) => {
    if (!filePaths.includes(path)) {
      issues.push({
        level: 'error',
        code: 'packaging.missing-required-file',
        scope: 'packaging',
        targetId: path,
        message: `Packaging plan expects "${path}" but it is missing from the bundle.`,
      });
    }
  });

  if (!filePaths.includes(packagingPlan.entryFile)) {
    issues.push({
      level: 'error',
      code: 'entry.missing',
      scope: 'entry',
      targetId: packagingPlan.entryFile,
      message: `Package entry file "${packagingPlan.entryFile}" is missing.`,
    });
  }

  if (packagingPlan.requiresSingleRootDocument && htmlFiles.length !== 1) {
    issues.push({
      level: 'error',
      code: 'entry.multiple-html-files',
      scope: 'entry',
      message: 'Package requires a single root HTML document, but the bundle contains multiple HTML files.',
    });
  }

  if (filePaths.includes('index.html')) {
    const html = bundle.files.find((file) => file.path === 'index.html')?.content ?? '';
    if (!html.includes('./runtime.js')) {
      issues.push({
        level: 'warning',
        code: 'runtime.missing-script-reference',
        scope: 'runtime',
        targetId: 'index.html',
        message: 'index.html does not reference runtime.js.',
      });
    }
    if (clickTagChannel && !html.includes('window.clickTag = window.clickTag ||')) {
      issues.push({
        level: 'error',
        code: 'exit.clicktag-bootstrap-missing',
        scope: 'entry',
        targetId: 'index.html',
        message: `${bundle.channel} package is missing the clickTag bootstrap in index.html.`,
      });
    }
    if (mraidChannel && !html.includes('window.mraid') && !html.includes('window.smxMraidState')) {
      issues.push({
        level: 'error',
        code: 'runtime.mraid-bootstrap-missing',
        scope: 'runtime',
        targetId: 'index.html',
        message: 'mraid package is missing the MRAID bootstrap in index.html.',
      });
    }
  }

  if (packagingPlan.sceneCount > 1 && !filePaths.includes('runtime.js')) {
    issues.push({
      level: 'error',
      code: 'runtime.missing-runtime-js',
      scope: 'runtime',
      targetId: 'runtime.js',
      message: 'Multi-scene package is missing runtime.js.',
    });
  }

  if ((exitConfig.strategy === 'clickTag' || exitConfig.strategy === 'window-open' || exitConfig.strategy === 'mraid-open') && !exitConfig.primaryUrl) {
    issues.push({
      level: 'error',
      code: 'exit.missing-primary-url',
      scope: 'exit',
      message: `Exit strategy "${exitConfig.strategy}" requires a primary clickthrough URL.`,
    });
  }

  if (packagingPlan.exitStrategy !== exitConfig.strategy) {
    issues.push({
      level: 'warning',
      code: 'exit.strategy-mismatch',
      scope: 'exit',
      message: `Packaging exit strategy "${packagingPlan.exitStrategy}" does not match exit config "${exitConfig.strategy}".`,
    });
  }

  const assetPathSet = new Set<string>();
  assetPlan.forEach((asset) => {
    if (assetPathSet.has(asset.packagingPath)) {
      issues.push({
        level: 'error',
        code: 'asset.duplicate-packaging-path',
        scope: 'asset',
        targetId: asset.packagingPath,
        message: `Asset plan reuses packaging path "${asset.packagingPath}".`,
      });
    }
    assetPathSet.add(asset.packagingPath);
  });

  if ((bundle.channel === 'google-display' || bundle.channel === 'gam-html5') && assetPlan.length && packagingPlan.externalAssetMode === 'referenced') {
    issues.push({
      level: 'warning',
      code: 'asset.remote-reference-mode',
      scope: 'asset',
      message: 'Package still references remote assets. For stricter ad-hosting compatibility, prefer rewriting assets to local bundle paths.',
    });
  }

  if (bundle.channel === 'google-display' && remoteReferencedAssetCount > 0) {
    issues.push({
      level: 'error',
      code: 'asset.google-display-localization-required',
      scope: 'asset',
      message: 'google-display packages should localize remote assets into the ZIP instead of shipping remote references.',
    });
  }

  if (bundledAssetCount > 0 && !filePaths.includes('remote-fetch-plan.json')) {
    issues.push({
      level: 'warning',
      code: 'asset.missing-remote-fetch-plan',
      scope: 'asset',
      targetId: 'remote-fetch-plan.json',
      message: 'Bundle localizes remote assets but does not emit a remote-fetch-plan.json describing pending binary materialization.',
    });
  }

  if (bundledAssetCount > 0) {
    if (materializedAssets.length !== bundledAssetCount) {
      issues.push({
        level: 'warning',
        code: 'asset.bundle-materialization-pending',
        scope: 'asset',
        message: 'Bundle rewrites assets to local paths, but binary asset files are not yet materialized inside the ZIP.',
      });
      if (clickTagChannel) {
        issues.push({
          level: 'error',
          code: 'asset.clicktag-channel-materialization-required',
          scope: 'asset',
          message: `${bundle.channel} package still has pending localized assets. Run the resolved ZIP flow before handoff.`,
        });
      }
    }
  }

  if (totalBytes > 1024 * 1024 * 2) {
    issues.push({
      level: 'warning',
      code: 'bundle.large-size',
      scope: 'bundle',
      message: `Bundle size is ${Math.round(totalBytes / 1024)} KB. Large packages can create ad-hosting friction.`,
    });
  }

  const recommendedBytesByChannel: Partial<Record<ExportBundle['channel'], number>> = {
    'google-display': 200 * 1024,
    'gam-html5': 200 * 1024,
    'mraid': 500 * 1024,
    'meta-story': 5 * 1024 * 1024,
    'tiktok-vertical': 5 * 1024 * 1024,
    'generic-html5': 2 * 1024 * 1024,
  };
  const recommendedBytes = recommendedBytesByChannel[bundle.channel];

  if (recommendedBytes != null && packageMetrics.totalBytes > recommendedBytes) {
    issues.push({
      level: 'warning',
      code: 'bundle.channel-size-warning',
      scope: 'bundle',
      message: `${bundle.channel} package is ${Math.round(packageMetrics.totalBytes / 1024)} KB, above the current recommended budget of ${Math.round(recommendedBytes / 1024)} KB.`,
    });
  }

  return issues;
}
