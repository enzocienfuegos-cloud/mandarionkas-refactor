import type { GamHtml5AdapterResult, GenericHtml5AdapterResult, GoogleDisplayAdapterResult, MraidAdapterResult, PlayableExportAdapterResult } from './adapters';
import type { ExportHtmlAdapter } from './html';

export type ExportPackagingPlan = {
  adapter: ExportHtmlAdapter['adapter'];
  format: 'single-page-html' | 'playable-html';
  entryFile: 'index.html';
  bootstrapFile: 'inline';
  exitStrategy: 'clickTag' | 'window-open' | 'playable-bridge' | 'mraid-open';
  requiresSingleRootDocument: boolean;
  politeLoad: boolean;
  sceneCount: number;
  externalAssetMode: 'referenced' | 'localized-bundle';
  emittedFiles: string[];
};

export type ExportExitConfig = {
  adapter: ExportHtmlAdapter['adapter'];
  strategy: 'clickTag' | 'window-open' | 'playable-bridge' | 'mraid-open';
  primaryUrl: string | null;
  urls: string[];
};

function getClickthroughUrls(adapter: ExportHtmlAdapter): string[] {
  if (adapter.adapter === 'playable-ad') {
    return adapter.bootstrap.clickthroughs.map((item) => item.url).filter(Boolean);
  }
  return adapter.portableProject.interactions
    .filter((interaction) => interaction.type === 'open-url' && interaction.url)
    .map((interaction) => interaction.url as string);
}

function buildGenericPackagingPlan(adapter: GenericHtml5AdapterResult): ExportPackagingPlan {
  return {
    adapter: adapter.adapter,
    format: 'single-page-html',
    entryFile: adapter.htmlShell.entry,
    bootstrapFile: 'inline',
    exitStrategy: 'window-open',
    requiresSingleRootDocument: adapter.htmlShell.usesSingleDocument,
    politeLoad: adapter.htmlShell.politeLoad,
    sceneCount: adapter.htmlShell.sceneCount,
    externalAssetMode: 'localized-bundle',
    emittedFiles: ['index.html', 'runtime.js', 'manifest.json', 'portable-project.json', 'portable-project.localized.json', 'runtime-model.json', 'adapter.json', 'packaging-plan.json', 'exit-config.json', 'asset-plan.json', 'remote-fetch-plan.json', 'readiness.json', 'package-metrics.json', 'package-compliance.json'],
  };
}

function buildGooglePackagingPlan(adapter: GoogleDisplayAdapterResult): ExportPackagingPlan {
  return {
    adapter: adapter.adapter,
    format: 'single-page-html',
    entryFile: adapter.display.entry,
    bootstrapFile: 'inline',
    exitStrategy: 'clickTag',
    requiresSingleRootDocument: true,
    politeLoad: true,
    sceneCount: adapter.portableProject.scenes.length,
    externalAssetMode: 'localized-bundle',
    emittedFiles: ['index.html', 'runtime.js', 'manifest.json', 'portable-project.json', 'portable-project.localized.json', 'runtime-model.json', 'adapter.json', 'packaging-plan.json', 'exit-config.json', 'asset-plan.json', 'remote-fetch-plan.json', 'readiness.json', 'package-metrics.json', 'package-compliance.json'],
  };
}

function buildGamPackagingPlan(adapter: GamHtml5AdapterResult): ExportPackagingPlan {
  return {
    adapter: adapter.adapter,
    format: 'single-page-html',
    entryFile: adapter.html5.entry,
    bootstrapFile: 'inline',
    exitStrategy: 'clickTag',
    requiresSingleRootDocument: adapter.html5.requiresSingleRootDocument,
    politeLoad: adapter.html5.supportsPoliteLoad,
    sceneCount: adapter.portableProject.scenes.length,
    externalAssetMode: 'localized-bundle',
    emittedFiles: ['index.html', 'runtime.js', 'manifest.json', 'portable-project.json', 'portable-project.localized.json', 'runtime-model.json', 'adapter.json', 'packaging-plan.json', 'exit-config.json', 'asset-plan.json', 'remote-fetch-plan.json', 'readiness.json', 'package-metrics.json', 'package-compliance.json'],
  };
}

function buildMraidPackagingPlan(adapter: MraidAdapterResult): ExportPackagingPlan {
  return {
    adapter: adapter.adapter,
    format: 'single-page-html',
    entryFile: adapter.mraid.entry,
    bootstrapFile: 'inline',
    exitStrategy: 'mraid-open',
    requiresSingleRootDocument: true,
    politeLoad: true,
    sceneCount: adapter.portableProject.scenes.length,
    externalAssetMode: 'localized-bundle',
    emittedFiles: ['index.html', 'runtime.js', 'manifest.json', 'portable-project.json', 'portable-project.localized.json', 'runtime-model.json', 'adapter.json', 'packaging-plan.json', 'exit-config.json', 'asset-plan.json', 'remote-fetch-plan.json', 'readiness.json', 'package-metrics.json', 'package-compliance.json'],
  };
}

function buildPlayablePackagingPlan(adapter: PlayableExportAdapterResult): ExportPackagingPlan {
  return {
    adapter: adapter.adapter,
    format: 'playable-html',
    entryFile: 'index.html',
    bootstrapFile: 'inline',
    exitStrategy: 'playable-bridge',
    requiresSingleRootDocument: true,
    politeLoad: true,
    sceneCount: adapter.bootstrap.totalScenes,
    externalAssetMode: 'localized-bundle',
    emittedFiles: ['index.html', 'runtime.js', 'manifest.json', 'portable-project.json', 'portable-project.localized.json', 'runtime-model.json', 'adapter.json', 'packaging-plan.json', 'exit-config.json', 'asset-plan.json', 'remote-fetch-plan.json', 'readiness.json', 'package-metrics.json', 'package-compliance.json'],
  };
}

export function buildExportPackagingPlan(adapter: ExportHtmlAdapter): ExportPackagingPlan {
  switch (adapter.adapter) {
    case 'generic-html5':
      return buildGenericPackagingPlan(adapter);
    case 'google-display':
      return buildGooglePackagingPlan(adapter);
    case 'gam-html5':
      return buildGamPackagingPlan(adapter);
    case 'mraid':
      return buildMraidPackagingPlan(adapter);
    case 'playable-ad':
      return buildPlayablePackagingPlan(adapter);
    default:
      return buildGenericPackagingPlan(adapter);
  }
}

export function buildExportExitConfig(adapter: ExportHtmlAdapter): ExportExitConfig {
  const urls = getClickthroughUrls(adapter);
  switch (adapter.adapter) {
    case 'generic-html5':
      return { adapter: adapter.adapter, strategy: 'window-open', primaryUrl: urls[0] ?? null, urls };
    case 'google-display':
    case 'gam-html5':
      return { adapter: adapter.adapter, strategy: 'clickTag', primaryUrl: urls[0] ?? null, urls };
    case 'mraid':
      return { adapter: adapter.adapter, strategy: 'mraid-open', primaryUrl: urls[0] ?? null, urls };
    case 'playable-ad':
      return { adapter: adapter.adapter, strategy: 'playable-bridge', primaryUrl: urls[0] ?? null, urls };
  }
}
