import type { StudioState } from '../domain/document/types';
import type { ChannelRequirement } from './types';
import type { ExportPackageComplianceIssue } from './package-compliance';
import type { ExportPackageMetrics } from './package-metrics';
import type { ExportPackagingPlan } from './packaging';
import type { ExportRemoteAssetFetchEntry } from './assets';
import { buildExportBundle } from './bundle';
import { getChannelRequirements } from './channels';

export type ExportPreflightSummary = {
  blockers: number;
  warnings: number;
  channelErrors: number;
  channelWarnings: number;
  remoteAssetPendingCount: number;
  resolvedAssetCount: number;
  packageScore: number;
  packageGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  readyForBundleZip: boolean;
  readyForResolvedZip: boolean;
  deliveryMode: 'blocked' | 'bundle-only' | 'resolved-ready';
  preferredArtifact: 'zip-bundle' | 'zip-resolved';
  topBlocker?: string;
  topWarning?: string;
  recommendedNextStep: string;
};

export type ExportPreflight = {
  metrics: ExportPackageMetrics;
  compliance: ExportPackageComplianceIssue[];
  packagingPlan: ExportPackagingPlan;
  remoteFetchPlan: ExportRemoteAssetFetchEntry[];
  channelChecklist: ChannelRequirement[];
  channelBlockers: ChannelRequirement[];
  channelWarnings: ChannelRequirement[];
  packageBlockers: ExportPackageComplianceIssue[];
  packageWarnings: ExportPackageComplianceIssue[];
  summary: ExportPreflightSummary;
};

function parseBundleJsonFile<T>(bundle: ReturnType<typeof buildExportBundle>, path: string, fallback: T): T {
  const content = bundle.files.find((file) => file.path === path)?.content;
  if (!content) return fallback;
  try {
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

function buildPreflightSummary(
  packagingPlan: ExportPackagingPlan,
  channelChecklist: ChannelRequirement[],
  compliance: ExportPackageComplianceIssue[],
  metrics: ExportPackageMetrics,
  remoteFetchPlan: ExportRemoteAssetFetchEntry[],
): ExportPreflightSummary {
  const channelBlockers = channelChecklist.filter((item) => !item.passed && item.severity === 'error');
  const channelWarnings = channelChecklist.filter((item) => !item.passed && item.severity !== 'error');
  const packageBlockers = compliance.filter((issue) => issue.level === 'error');
  const packageWarnings = compliance.filter((issue) => issue.level === 'warning');
  const blockers = channelBlockers.length + packageBlockers.length;
  const warnings = channelWarnings.length + packageWarnings.length;
  const remoteAssetPendingCount = Math.max(0, remoteFetchPlan.length - metrics.materializedAssetCount);
  const resolvedAssetCount = metrics.materializedAssetCount;
  const rawScore = Math.round(100 - blockers * 20 - warnings * 5 - remoteAssetPendingCount * 4);
  const packageScore = Math.max(0, Math.min(100, rawScore));
  const packageGrade: ExportPreflightSummary['packageGrade'] =
    packageScore >= 90 ? 'A' : packageScore >= 80 ? 'B' : packageScore >= 70 ? 'C' : packageScore >= 60 ? 'D' : 'F';
  const topBlocker = channelBlockers[0]?.label ?? packageBlockers[0]?.message;
  const topWarning = channelWarnings[0]?.label ?? packageWarnings[0]?.message;
  const deliveryMode: ExportPreflightSummary['deliveryMode'] =
    blockers > 0 ? 'blocked' : remoteAssetPendingCount > 0 ? 'bundle-only' : 'resolved-ready';
  const preferredArtifact: ExportPreflightSummary['preferredArtifact'] =
    packagingPlan.adapter === 'google-display' || packagingPlan.adapter === 'gam-html5' || remoteFetchPlan.length > 0
      ? 'zip-resolved'
      : 'zip-bundle';

  let recommendedNextStep = 'Package is ready for resolved ZIP export.';
  if (channelBlockers.length) {
    recommendedNextStep = `Fix required channel rule: ${channelBlockers[0].label}.`;
  } else if (packageBlockers.length) {
    recommendedNextStep = packageBlockers[0].message;
  } else if (preferredArtifact === 'zip-resolved' && remoteAssetPendingCount === 0) {
    recommendedNextStep = 'Export the resolved ZIP artifact for final channel handoff.';
  } else if (remoteAssetPendingCount > 0) {
    recommendedNextStep = 'Run ZIP resolved to materialize remote assets into the bundle.';
  } else if (channelWarnings.length) {
    recommendedNextStep = `Harden channel fit: ${channelWarnings[0].label}.`;
  } else if (packageWarnings.length) {
    recommendedNextStep = packageWarnings[0].message;
  }

  return {
    blockers,
    warnings,
    channelErrors: channelBlockers.length,
    channelWarnings: channelWarnings.length,
    remoteAssetPendingCount,
    resolvedAssetCount,
    packageScore,
    packageGrade,
    readyForBundleZip: blockers === 0,
    readyForResolvedZip: blockers === 0 && remoteAssetPendingCount === 0,
    deliveryMode,
    preferredArtifact,
    topBlocker,
    topWarning,
    recommendedNextStep,
  };
}

export function buildExportPreflight(state: StudioState): ExportPreflight {
  const bundle = buildExportBundle(state);
  const metrics = parseBundleJsonFile<ExportPackageMetrics>(bundle, 'package-metrics.json', {
    totalBytes: 0,
    totalFiles: 0,
    assetCount: 0,
    remoteBundledAssetCount: 0,
    inlineAssetCount: 0,
    materializedAssetCount: 0,
    htmlBytes: 0,
    javascriptBytes: 0,
    jsonBytes: 0,
    binaryBytes: 0,
  });
  const compliance = parseBundleJsonFile<ExportPackageComplianceIssue[]>(bundle, 'package-compliance.json', []);
  const remoteFetchPlan = parseBundleJsonFile<ExportRemoteAssetFetchEntry[]>(bundle, 'remote-fetch-plan.json', []);
  const channelChecklist = getChannelRequirements(state.document.metadata.release.targetChannel, state);
  const channelBlockers = channelChecklist.filter((item) => !item.passed && item.severity === 'error');
  const channelWarnings = channelChecklist.filter((item) => !item.passed && item.severity !== 'error');
  const packageBlockers = compliance.filter((item) => item.level === 'error');
  const packageWarnings = compliance.filter((item) => item.level === 'warning');
  const packagingPlan = parseBundleJsonFile<ExportPackagingPlan>(bundle, 'packaging-plan.json', {
    adapter: 'generic-html5',
    format: 'single-page-html',
    entryFile: 'index.html',
    bootstrapFile: 'inline',
    exitStrategy: 'window-open',
    requiresSingleRootDocument: true,
    politeLoad: false,
    sceneCount: 0,
    externalAssetMode: 'referenced',
    emittedFiles: [],
  });

  return {
    metrics,
    compliance,
    packagingPlan,
    remoteFetchPlan,
    channelChecklist,
    channelBlockers,
    channelWarnings,
    packageBlockers,
    packageWarnings,
    summary: buildPreflightSummary(packagingPlan, channelChecklist, compliance, metrics, remoteFetchPlan),
  };
}
