import type { StudioState } from '../domain/document/types';
import { buildGenericHtml5Adapter } from './adapters/generic-html5';
import { buildGamHtml5Adapter } from './adapters/gam-html5';
import { buildGoogleDisplayAdapter } from './adapters/google-display';
import { buildMraidAdapter } from './adapters/mraid';
import { buildPlayableExportAdapter } from './adapters/playable';
import { buildVastSimidAdapter } from './adapters/vast-simid';
import { buildVastSimidXml, type PlayableExportAdapterResult, type VastSimidAdapterResult } from './adapters';
import { buildExportAssetPlan, buildLocalizedPortableProject, buildRemoteAssetFetchPlan, materializeExportAssetFiles, materializeRemoteExportAssetFiles } from './assets';
import { buildChannelHtml, buildPlayableSingleFileHtml } from './html';
import { buildExportManifest } from './manifest';
import { buildExportPackageMetrics } from './package-metrics';
import { validateExportPackage } from './package-compliance';
import { buildExportExitConfig, buildExportPackagingPlan } from './packaging';
import { buildPortableProjectExport } from './portable';
import { buildExportReadiness } from './readiness';
import { buildExportRuntimeModelFromPortable } from './runtime-model';
import { buildExportRuntimeScript } from './runtime-script';

export type ExportBundleFile = {
  path: string;
  mime: string;
  content?: string;
  bytes?: Uint8Array;
};

export type ExportBundle = {
  channel: StudioState['document']['metadata']['release']['targetChannel'];
  files: ExportBundleFile[];
};

function buildChannelAdapter(state: StudioState) {
  switch (state.document.metadata.release.targetChannel) {
    case 'generic-html5':
      return buildGenericHtml5Adapter(state);
    case 'google-display':
      return buildGoogleDisplayAdapter(state);
    case 'gam-html5':
      return buildGamHtml5Adapter(state);
    case 'mraid':
      return buildMraidAdapter(state);
    case 'vast-simid':
      return buildVastSimidAdapter(state);
    case 'meta-story':
    case 'tiktok-vertical':
      return buildPlayableExportAdapter(state);
    default:
      return buildGenericHtml5Adapter(state);
  }
}

function buildBundleFromAssetFiles(
  state: StudioState,
  assetFiles: ExportBundleFile[],
): ExportBundle {
  const portableProject = buildPortableProjectExport(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(portableProject);
  const adapter = buildChannelAdapter(state);
  const manifest = buildExportManifest(state);
  const readiness = buildExportReadiness(state);
  const assetPlan = buildExportAssetPlan(portableProject);
  const remoteFetchPlan = buildRemoteAssetFetchPlan(assetPlan);
  const localizedPortableProject = buildLocalizedPortableProject(portableProject, assetPlan);
  const localizedAdapter = adapter.adapter === 'playable-ad'
    ? { ...adapter, playableProject: localizedPortableProject }
    : { ...adapter, portableProject: localizedPortableProject };
  const html = localizedAdapter.adapter === 'playable-ad'
    ? buildPlayableSingleFileHtml(state, localizedAdapter as PlayableExportAdapterResult, {})
    : localizedAdapter.adapter === 'vast-simid'
      ? buildChannelHtml(state, { ...(localizedAdapter as VastSimidAdapterResult), adapter: 'generic-html5' } as any)
      : buildChannelHtml(state, localizedAdapter as any);
  const packagingPlan = buildExportPackagingPlan(localizedAdapter);
  const exitConfig = buildExportExitConfig(localizedAdapter);
  const runtimeScript = buildExportRuntimeScript(adapter);
  const bundleFiles: ExportBundleFile[] = [
    { path: 'index.html', mime: 'text/html;charset=utf-8', content: html },
    ...(localizedAdapter.adapter === 'vast-simid'
      ? [{ path: 'vast.xml', mime: 'application/xml;charset=utf-8', content: buildVastSimidXml(localizedAdapter as VastSimidAdapterResult) }]
      : []),
    { path: 'runtime.js', mime: 'text/javascript;charset=utf-8', content: runtimeScript },
    { path: 'manifest.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(manifest, null, 2) },
    { path: 'portable-project.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(portableProject, null, 2) },
    { path: 'portable-project.localized.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(localizedPortableProject, null, 2) },
    { path: 'runtime-model.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(runtimeModel, null, 2) },
    { path: 'adapter.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(localizedAdapter, null, 2) },
    { path: 'packaging-plan.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(packagingPlan, null, 2) },
    { path: 'exit-config.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(exitConfig, null, 2) },
    { path: 'asset-plan.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(assetPlan, null, 2) },
    { path: 'remote-fetch-plan.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(remoteFetchPlan, null, 2) },
    { path: 'readiness.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(readiness, null, 2) },
    ...assetFiles,
  ];
  const packageMetrics = buildExportPackageMetrics({ channel: state.document.metadata.release.targetChannel, files: bundleFiles }, assetPlan);
  const bundleBase: ExportBundle = {
    channel: state.document.metadata.release.targetChannel,
    files: [
      ...bundleFiles,
      { path: 'package-metrics.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(packageMetrics, null, 2) },
      { path: 'package-compliance.json', mime: 'application/json;charset=utf-8', content: '[]' },
    ],
  };
  const packageCompliance = validateExportPackage(bundleBase, packagingPlan, exitConfig, assetPlan);

  return {
    channel: state.document.metadata.release.targetChannel,
    files: [
      ...bundleBase.files.map((file) =>
        file.path === 'package-compliance.json'
          ? { ...file, content: JSON.stringify(packageCompliance, null, 2) }
          : file),
    ],
  };
}

export function buildExportBundle(state: StudioState): ExportBundle {
  return buildBundleFromAssetFiles(state, materializeExportAssetFiles(buildExportAssetPlan(buildPortableProjectExport(state))));
}

export async function buildExportBundleWithRemoteAssets(
  state: StudioState,
  fetchImpl: typeof fetch = fetch,
): Promise<ExportBundle> {
  const portableProject = buildPortableProjectExport(state);
  const assetPlan = buildExportAssetPlan(portableProject);
  const inlineAssetFiles = materializeExportAssetFiles(assetPlan);
  const remoteAssetFiles = await materializeRemoteExportAssetFiles(assetPlan, fetchImpl);
  return buildBundleFromAssetFiles(state, [...inlineAssetFiles, ...remoteAssetFiles]);
}
