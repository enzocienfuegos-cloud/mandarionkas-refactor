import type { StudioState } from '../domain/document/types';
import { buildChannelHtml, buildPlayableSingleFileHtml, buildStandaloneHtml } from './html';
import { buildExportAssetPlan, buildLocalizedPortableProject, buildRemoteAssetFetchPlan, materializeExportAssetFiles } from './assets';
import { buildExportManifest } from './manifest';
import { buildExportPackageMetrics } from './package-metrics';
import { validateExportPackage } from './package-compliance';
import { buildExportExitConfig, buildExportPackagingPlan } from './packaging';
import { buildExportPreflight } from './preflight';
import { buildPortableProjectExport } from './portable';
import { buildExportRuntimeModelFromPortable } from './runtime-model';
import { buildExportRuntimeScript } from './runtime-script';
import { buildExportReadiness } from './readiness';
import { buildGenericHtml5Adapter } from './adapters/generic-html5';
import { buildGamHtml5Adapter } from './adapters/gam-html5';
import { buildGoogleDisplayAdapter } from './adapters/google-display';
import { buildMraidAdapter } from './adapters/mraid';
import { buildPlayableExportAdapter } from './adapters/playable';
import { buildVastSimidAdapter } from './adapters/vast-simid';
import { buildVastSimidXml, type MraidAdapterResult, type PlayableExportAdapterResult, type VastSimidAdapterResult } from './adapters';
import { getMraidProjectCompatibility } from './mraid-compatibility';

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

function buildMraidHandoffSummary(preflight: ReturnType<typeof buildExportPreflight>, channelAdapter: ReturnType<typeof buildChannelAdapter>) {
  if (channelAdapter.adapter !== 'mraid') return undefined;
  const mraidAdapter = channelAdapter as MraidAdapterResult;
  const compatibility = getMraidProjectCompatibility(mraidAdapter.portableProject);
  const blockedModules = compatibility.filter((item) => item.level === 'blocked');
  const warningModules = compatibility.filter((item) => item.level === 'warning');
  const mraidWarnings = [
    ...preflight.channelWarnings.filter((item) => item.id.startsWith('mraid-')).map((item) => item.label),
    ...preflight.packageWarnings.filter((item) => item.code.startsWith('runtime.mraid') || item.code.startsWith('widget.mraid')).map((item) => item.message),
  ];
  const mraidBlockers = [
    ...preflight.channelBlockers.filter((item) => item.id.startsWith('mraid-')).map((item) => item.label),
    ...preflight.packageBlockers.filter((item) => item.code.startsWith('runtime.mraid') || item.code.startsWith('widget.mraid')).map((item) => item.message),
  ];
  return {
    apiVersion: mraidAdapter.mraid.apiVersion,
    placementType: mraidAdapter.mraid.expectedHost.placementType,
    supportedSizes: mraidAdapter.mraid.supportedSizes,
    standardSize: mraidAdapter.mraid.standardSize,
    requiresMraidOpen: mraidAdapter.mraid.requiresMraidOpen,
    requiredHostFeatures: mraidAdapter.mraid.requiredHostFeatures,
    expectedHost: mraidAdapter.mraid.expectedHost,
    moduleCompatibility: {
      supportedCount: Math.max(0, mraidAdapter.portableProject.scenes.reduce((count, scene) => count + scene.widgets.length, 0) - warningModules.length - blockedModules.length),
      warningCount: warningModules.length,
      blockedCount: blockedModules.length,
      warnings: warningModules.map((item) => ({ widgetId: item.widgetId, widgetType: item.type, message: item.message })),
      blocked: blockedModules.map((item) => ({ widgetId: item.widgetId, widgetType: item.type, message: item.message })),
    },
    readyForHostHandoff: preflight.summary.readyForResolvedZip && mraidBlockers.length === 0,
    blockers: mraidBlockers,
    warnings: mraidWarnings,
  };
}

export function buildExportHandoff(state: StudioState) {
  const preflight = buildExportPreflight(state);
  const channelAdapter = buildChannelAdapter(state);
  return {
    preferredArtifact: preflight.summary.preferredArtifact,
    deliveryMode: preflight.summary.deliveryMode,
    recommendedNextStep: preflight.summary.recommendedNextStep,
    readyForBundleZip: preflight.summary.readyForBundleZip,
    readyForResolvedZip: preflight.summary.readyForResolvedZip,
    topBlocker: preflight.summary.topBlocker,
    topWarning: preflight.summary.topWarning,
    channelBlockers: preflight.channelBlockers.map((item) => item.label),
    channelWarnings: preflight.channelWarnings.map((item) => item.label),
    packageBlockers: preflight.packageBlockers.map((item) => item.message),
    packageWarnings: preflight.packageWarnings.map((item) => item.message),
    mraid: buildMraidHandoffSummary(preflight, channelAdapter),
  };
}

export function buildPublishPackage(state: StudioState, exportedState: StudioState = state): string {
  const preflight = buildExportPreflight(exportedState);
  const portableProject = buildPortableProjectExport(exportedState);
  const channelAdapter = buildChannelAdapter(exportedState);
  const runtimeModel = buildExportRuntimeModelFromPortable(portableProject);
  const assetPlan = buildExportAssetPlan(portableProject);
  const remoteFetchPlan = buildRemoteAssetFetchPlan(assetPlan);
  const materializedAssetFiles = materializeExportAssetFiles(assetPlan);
  const localizedPortableProject = buildLocalizedPortableProject(portableProject, assetPlan);
  const localizedAdapter = channelAdapter.adapter === 'playable-ad'
    ? { ...channelAdapter, playableProject: localizedPortableProject }
    : { ...channelAdapter, portableProject: localizedPortableProject };
  const packagingPlan = buildExportPackagingPlan(localizedAdapter);
  const exitConfig = buildExportExitConfig(localizedAdapter);
  const runtimeScript = buildExportRuntimeScript(channelAdapter);
  const playableHtml = localizedAdapter.adapter === 'playable-ad'
    ? buildPlayableSingleFileHtml(exportedState, localizedAdapter as PlayableExportAdapterResult, {})
    : null;
  const primaryHtml = playableHtml ?? buildChannelHtml(exportedState, localizedAdapter);
  const packageMetrics = buildExportPackageMetrics({
    channel: exportedState.document.metadata.release.targetChannel,
    files: [
      { path: 'index.html', mime: 'text/html;charset=utf-8', content: primaryHtml },
      ...(localizedAdapter.adapter === 'vast-simid'
        ? [{ path: 'vast.xml', mime: 'application/xml;charset=utf-8', content: buildVastSimidXml(localizedAdapter as VastSimidAdapterResult) }]
        : []),
      { path: 'runtime.js', mime: 'text/javascript;charset=utf-8', content: runtimeScript },
      { path: 'manifest.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(buildExportManifest(exportedState), null, 2) },
      { path: 'portable-project.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(portableProject, null, 2) },
      { path: 'portable-project.localized.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(localizedPortableProject, null, 2) },
      { path: 'runtime-model.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(runtimeModel, null, 2) },
      { path: 'adapter.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(localizedAdapter, null, 2) },
      { path: 'packaging-plan.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(packagingPlan, null, 2) },
      { path: 'exit-config.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(exitConfig, null, 2) },
      { path: 'asset-plan.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(assetPlan, null, 2) },
      { path: 'remote-fetch-plan.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(remoteFetchPlan, null, 2) },
      { path: 'readiness.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(buildExportReadiness(state), null, 2) },
      ...materializedAssetFiles,
    ],
  }, assetPlan);
  const packageProbe = {
    channel: exportedState.document.metadata.release.targetChannel,
    files: [
      { path: 'index.html', mime: 'text/html;charset=utf-8', content: primaryHtml },
      ...(localizedAdapter.adapter === 'vast-simid'
        ? [{ path: 'vast.xml', mime: 'application/xml;charset=utf-8', content: '' }]
        : []),
      { path: 'runtime.js', mime: 'text/javascript;charset=utf-8', content: runtimeScript },
      { path: 'manifest.json', mime: 'application/json;charset=utf-8', content: '' },
      { path: 'portable-project.json', mime: 'application/json;charset=utf-8', content: '' },
      { path: 'portable-project.localized.json', mime: 'application/json;charset=utf-8', content: '' },
      { path: 'runtime-model.json', mime: 'application/json;charset=utf-8', content: '' },
      { path: 'adapter.json', mime: 'application/json;charset=utf-8', content: '' },
      { path: 'packaging-plan.json', mime: 'application/json;charset=utf-8', content: '' },
      { path: 'exit-config.json', mime: 'application/json;charset=utf-8', content: '' },
      { path: 'asset-plan.json', mime: 'application/json;charset=utf-8', content: '' },
      { path: 'remote-fetch-plan.json', mime: 'application/json;charset=utf-8', content: '' },
      { path: 'readiness.json', mime: 'application/json;charset=utf-8', content: '' },
      { path: 'package-metrics.json', mime: 'application/json;charset=utf-8', content: '' },
      { path: 'package-compliance.json', mime: 'application/json;charset=utf-8', content: '' },
      ...materializedAssetFiles.map((file) => ({ path: file.path, mime: file.mime, content: '' })),
    ],
  } as const;
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    manifest: buildExportManifest(exportedState),
    readiness: buildExportReadiness(exportedState),
    portableProject,
    localizedPortableProject,
    runtimeModel,
    assetPlan,
    remoteFetchPlan,
    materializedAssetFiles: materializedAssetFiles.map((file) => ({ path: file.path, mime: file.mime, bytes: file.bytes?.length ?? 0 })),
    channelAdapter: localizedAdapter,
    packagingPlan,
    exitConfig,
    runtimeScript,
    packageMetrics,
    packageCompliance: validateExportPackage(packageProbe as any, packagingPlan, exitConfig, assetPlan),
    preflight,
    handoff: buildExportHandoff(exportedState),
    collaboration: exportedState.document.collaboration,
    document: exportedState.document,
    html: primaryHtml,
    previewHtml: buildStandaloneHtml(exportedState),
  }, null, 2);
}

export function buildReviewPackage(state: StudioState): string {
  const openComments = state.document.collaboration.comments.filter((item) => item.status === 'open');
  const pendingApprovals = state.document.collaboration.approvals.filter((item) => item.status === 'pending');
  const preflight = buildExportPreflight(state);
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    document: { id: state.document.id, name: state.document.name },
    activeSceneId: state.document.selection.activeSceneId,
    summary: {
      openComments: openComments.length,
      pendingApprovals: pendingApprovals.length,
      packageGrade: preflight.summary.packageGrade,
      packageScore: preflight.summary.packageScore,
      packageWarnings: preflight.summary.warnings,
      packageBlockers: preflight.summary.blockers,
      preferredArtifact: preflight.summary.preferredArtifact,
      deliveryMode: preflight.summary.deliveryMode,
    },
    handoff: buildExportHandoff(state),
    collaboration: state.document.collaboration,
    readiness: buildExportReadiness(state),
    manifest: buildExportManifest(state),
    preflight,
  }, null, 2);
}
