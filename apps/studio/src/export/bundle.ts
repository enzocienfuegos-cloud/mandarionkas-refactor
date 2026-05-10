import type { StudioState } from '../domain/document/types';
import { buildResolvedWidgetsById, syncDocumentCanvasToVariant } from '../domain/document/canvas-variants';
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
import { buildSharedAssetEntries, buildSizeSetManifest, type ExportSizeSetManifest, type SharedAssetRecord } from './bundle-size-set';
import { buildExportExitConfig, buildExportPackagingPlan } from './packaging';
import { buildPortableProjectExport } from './portable';
import { buildExportReadiness } from './readiness';
import { buildExportRuntimeModelFromPortable } from './runtime-model';
import { compileRuntime } from './runtime-script';
import type { ChannelRequirement } from './types';
import { getPortableChannelRequirements } from './channel-compliance';
import { buildChannelBudgetMeasurement } from './channel-budget-measurement';

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
export type { ExportSizeSetManifest };

type PreparedExportBundleInput = {
  portableProject: ReturnType<typeof buildPortableProjectExport>;
  localizedPortableProject: ReturnType<typeof buildPortableProjectExport>;
  assetPlan: ReturnType<typeof buildExportAssetPlan>;
  assetFiles: ExportBundleFile[];
};

type SizeSetVariantPlan = {
  variant: StudioState['document']['canvasVariants'][number];
  slug: string;
  state: StudioState;
  portableProject: ReturnType<typeof buildPortableProjectExport>;
  assetPlan: ReturnType<typeof buildExportAssetPlan>;
};

function toVariantSlug(width: number, height: number): string {
  return `${width}x${height}`;
}

function buildVariantExportState(state: StudioState, variantId: string): StudioState {
  const resolvedWidgets = buildResolvedWidgetsById(state.document, variantId);
  const nextDocument = syncDocumentCanvasToVariant({
    ...state.document,
    widgets: Object.fromEntries(
      Object.entries(resolvedWidgets).map(([widgetId, widget]) => [
        widgetId,
        {
          ...widget,
          frame: { ...widget.frame },
          props: { ...widget.props },
          style: { ...widget.style },
          timeline: {
            ...widget.timeline,
            keyframes: widget.timeline.keyframes?.map((keyframe) => ({ ...keyframe })),
          },
        },
      ]),
    ),
    activeCanvasVariantId: variantId,
  }, variantId);
  return {
    ...state,
    document: nextDocument,
  };
}

function prefixBundleFiles(files: ExportBundleFile[], prefix: string): ExportBundleFile[] {
  return files.map((file) => ({
    ...file,
    path: `${prefix}/${file.path}`,
  }));
}

function splitFileName(value: string): { stem: string; extension: string } {
  const match = value.match(/^(.*?)(\.[^.]*)?$/);
  return {
    stem: match?.[1] || value,
    extension: match?.[2] || '',
  };
}

function buildSizeSetVariantPlans(state: StudioState): SizeSetVariantPlan[] {
  const variants = state.document.canvasVariants.length
    ? state.document.canvasVariants
    : [{
        id: state.document.activeCanvasVariantId,
        label: `${state.document.canvas.width}×${state.document.canvas.height}`,
        width: state.document.canvas.width,
        height: state.document.canvas.height,
        backgroundColor: state.document.canvas.backgroundColor,
        presetId: state.document.canvas.presetId,
        isMaster: true,
      }];

  return variants.map((variant) => {
    const slug = toVariantSlug(variant.width, variant.height);
    const variantState = buildVariantExportState(state, variant.id);
    const portableProject = buildPortableProjectExport(variantState);
    const assetPlan = buildExportAssetPlan(portableProject);
    return {
      variant,
      slug,
      state: variantState,
      portableProject,
      assetPlan,
    };
  });
}

function buildSharedAssetRegistry(plans: SizeSetVariantPlan[]): SharedAssetRecord[] {
  const entryLists = plans.map((plan) => plan.assetPlan);
  const variantCounts = new Map<string, number>();
  const firstEntries = new Map<string, ReturnType<typeof buildExportAssetPlan>[number]>();
  const usedPaths = new Set<string>();

  entryLists.forEach((entries) => {
    const sourcesInVariant = new Set(entries.map((entry) => entry.sourceUrl));
    sourcesInVariant.forEach((sourceUrl) => {
      variantCounts.set(sourceUrl, (variantCounts.get(sourceUrl) ?? 0) + 1);
    });
    entries.forEach((entry) => {
      if (!firstEntries.has(entry.sourceUrl)) firstEntries.set(entry.sourceUrl, entry);
    });
  });

  return Array.from(variantCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([sourceUrl, variantCount]) => {
      const entry = firstEntries.get(sourceUrl)!;
      const { stem, extension } = splitFileName(entry.fileName);
      let candidate = `shared/assets/${entry.kind}/${entry.fileName}`;
      let suffix = 2;
      while (usedPaths.has(candidate)) {
        candidate = `shared/assets/${entry.kind}/${stem}-${suffix}${extension}`;
        suffix += 1;
      }
      usedPaths.add(candidate);
      return {
        sourceUrl,
        kind: entry.kind,
        fileName: entry.fileName,
        packagingPath: candidate,
        variantCount,
      };
    });
}

function buildBundleFromPreparedAssets(
  state: StudioState,
  input: PreparedExportBundleInput,
): ExportBundle {
  const { portableProject, localizedPortableProject, assetPlan, assetFiles } = input;
  const runtimeModel = buildExportRuntimeModelFromPortable(portableProject);
  const adapter = buildChannelAdapter(state);
  const remoteFetchPlan = buildRemoteAssetFetchPlan(assetPlan);
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
  const runtimeProject = adapter.adapter === 'playable-ad' ? adapter.playableProject : adapter.portableProject;
  const runtimeScript = compileRuntime(runtimeProject, adapter);
  const staticBundleFiles: ExportBundleFile[] = [
    { path: 'index.html', mime: 'text/html;charset=utf-8', content: html },
    ...(localizedAdapter.adapter === 'vast-simid'
      ? [{ path: 'vast.xml', mime: 'application/xml;charset=utf-8', content: buildVastSimidXml(localizedAdapter as VastSimidAdapterResult) }]
      : []),
    { path: 'runtime.js', mime: 'text/javascript;charset=utf-8', content: runtimeScript },
    { path: 'portable-project.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(portableProject, null, 2) },
    { path: 'portable-project.localized.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(localizedPortableProject, null, 2) },
    { path: 'runtime-model.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(runtimeModel, null, 2) },
    { path: 'adapter.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(localizedAdapter, null, 2) },
    { path: 'packaging-plan.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(packagingPlan, null, 2) },
    { path: 'exit-config.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(exitConfig, null, 2) },
    { path: 'asset-plan.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(assetPlan, null, 2) },
    { path: 'remote-fetch-plan.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(remoteFetchPlan, null, 2) },
    ...assetFiles,
  ];
  const targetChannel = state.document.metadata.release.targetChannel;

  function buildBundleBase(channelChecklist: ChannelRequirement[]): ExportBundle {
    const manifest = buildExportManifest(state, channelChecklist);
    const readiness = buildExportReadiness(state, channelChecklist);
    const filesWithChecklist = [
      ...staticBundleFiles,
      { path: 'manifest.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(manifest, null, 2) },
      { path: 'readiness.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(readiness, null, 2) },
    ];
    const packageMetrics = buildExportPackageMetrics({ channel: targetChannel, files: filesWithChecklist }, assetPlan);

    return {
      channel: targetChannel,
      files: [
        ...filesWithChecklist,
        { path: 'package-metrics.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(packageMetrics, null, 2) },
        { path: 'package-compliance.json', mime: 'application/json;charset=utf-8', content: '[]' },
      ],
    };
  }

  let channelChecklist = getPortableChannelRequirements(targetChannel, portableProject, runtimeModel);
  let bundleBase = buildBundleBase(channelChecklist);
  let measurement = buildChannelBudgetMeasurement(state, bundleBase, assetPlan, runtimeScript);
  channelChecklist = getPortableChannelRequirements(targetChannel, portableProject, runtimeModel, measurement);
  bundleBase = buildBundleBase(channelChecklist);
  measurement = buildChannelBudgetMeasurement(state, bundleBase, assetPlan, runtimeScript);
  channelChecklist = getPortableChannelRequirements(targetChannel, portableProject, runtimeModel, measurement);
  bundleBase = buildBundleBase(channelChecklist);
  const packageCompliance = validateExportPackage(bundleBase, packagingPlan, exitConfig, assetPlan);

  return {
    channel: targetChannel,
    files: [
      ...bundleBase.files.map((file) =>
        file.path === 'package-compliance.json'
          ? { ...file, content: JSON.stringify(packageCompliance, null, 2) }
          : file),
    ],
  };
}

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
  const assetPlan = buildExportAssetPlan(portableProject);
  const localizedPortableProject = buildLocalizedPortableProject(portableProject, assetPlan);
  return buildBundleFromPreparedAssets(state, {
    portableProject,
    localizedPortableProject,
    assetPlan,
    assetFiles,
  });
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

export function buildExportSizeSetBundle(state: StudioState): ExportBundle {
  const variantPlans = buildSizeSetVariantPlans(state);
  const sharedAssets = buildSharedAssetRegistry(variantPlans);
  const sharedAssetPathMap = new Map(sharedAssets.map((asset) => [asset.sourceUrl, asset.packagingPath]));
  const sharedAssetEntries = buildSharedAssetEntries(sharedAssets);
  const variantBundles = variantPlans.map((plan) => {
    const localizedEntries = plan.assetPlan.map((entry) =>
      sharedAssetPathMap.has(entry.sourceUrl)
        ? { ...entry, packagingPath: `../${sharedAssetPathMap.get(entry.sourceUrl)!}` }
        : entry);
    const localAssetPlan = plan.assetPlan.filter((entry) => !sharedAssetPathMap.has(entry.sourceUrl));
    const localizedPortableProject = buildLocalizedPortableProject(plan.portableProject, localizedEntries);
    const bundle = buildBundleFromPreparedAssets(plan.state, {
      portableProject: plan.portableProject,
      localizedPortableProject,
      assetPlan: localAssetPlan,
      assetFiles: materializeExportAssetFiles(localAssetPlan),
    });
    return {
      variant: plan.variant,
      slug: plan.slug,
      bundle,
    };
  });
  const manifest = buildSizeSetManifest(state, sharedAssets, variantBundles);

  return {
    channel: state.document.metadata.release.targetChannel,
    files: [
      { path: 'bundle/manifest.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(manifest, null, 2) },
      ...prefixBundleFiles(materializeExportAssetFiles(sharedAssetEntries), 'bundle'),
      ...variantBundles.flatMap(({ slug, bundle }) => prefixBundleFiles(bundle.files, `bundle/${slug}`)),
    ],
  };
}

export async function buildExportSizeSetBundleWithRemoteAssets(
  state: StudioState,
  fetchImpl: typeof fetch = fetch,
): Promise<ExportBundle> {
  const variantPlans = buildSizeSetVariantPlans(state);
  const sharedAssets = buildSharedAssetRegistry(variantPlans);
  const sharedAssetPathMap = new Map(sharedAssets.map((asset) => [asset.sourceUrl, asset.packagingPath]));
  const sharedAssetEntries = buildSharedAssetEntries(sharedAssets);
  const variantBundles = await Promise.all(
    variantPlans.map(async (plan) => {
      const localizedEntries = plan.assetPlan.map((entry) =>
        sharedAssetPathMap.has(entry.sourceUrl)
          ? { ...entry, packagingPath: `../${sharedAssetPathMap.get(entry.sourceUrl)!}` }
          : entry);
      const localAssetPlan = plan.assetPlan.filter((entry) => !sharedAssetPathMap.has(entry.sourceUrl));
      const localizedPortableProject = buildLocalizedPortableProject(plan.portableProject, localizedEntries);
      const bundle = buildBundleFromPreparedAssets(plan.state, {
        portableProject: plan.portableProject,
        localizedPortableProject,
        assetPlan: localAssetPlan,
        assetFiles: [
          ...materializeExportAssetFiles(localAssetPlan),
          ...(await materializeRemoteExportAssetFiles(localAssetPlan, fetchImpl)),
        ],
      });
      return {
        variant: plan.variant,
        slug: plan.slug,
        bundle,
      };
    }),
  );
  const manifest = buildSizeSetManifest(state, sharedAssets, variantBundles);

  return {
    channel: state.document.metadata.release.targetChannel,
    files: [
      { path: 'bundle/manifest.json', mime: 'application/json;charset=utf-8', content: JSON.stringify(manifest, null, 2) },
      ...prefixBundleFiles([
        ...materializeExportAssetFiles(sharedAssetEntries),
        ...(await materializeRemoteExportAssetFiles(sharedAssetEntries, fetchImpl)),
      ], 'bundle'),
      ...variantBundles.flatMap(({ slug, bundle }) => prefixBundleFiles(bundle.files, `bundle/${slug}`)),
    ],
  };
}
