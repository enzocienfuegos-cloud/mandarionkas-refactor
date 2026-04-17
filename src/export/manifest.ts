import { validateExport } from '../domain/document/export-validation';
import type { StudioState } from '../domain/document/types';
import type { ExportBuildOptions } from './types';
import { resolveExportCapabilities } from './capabilities';
import { getChannelRequirements } from './channels';
import { buildExportModel } from './model';
import type { ExportManifest } from './types';

export function buildExportManifest(state: StudioState, options: ExportBuildOptions = {}): ExportManifest {
  const issues = validateExport(state);
  const capabilitySummary = resolveExportCapabilities(state);
  const exportModel = buildExportModel(state, options);
  const partiallyCoveredTargetCount = exportModel.targetCoverage.filter((item) => item.coverage === 'partial').length;
  const uncoveredTargetCount = exportModel.targetCoverage.reduce((count, item) => count + item.missingTargets.length, 0);
  return {
    documentId: state.document.id,
    documentName: state.document.name,
    exportedAt: new Date().toISOString(),
    canvas: { ...state.document.canvas },
    activeVariant: state.ui.activeVariant,
    activeFeedSource: state.ui.activeFeedSource,
    activeFeedRecordId: state.ui.activeFeedRecordId,
    sceneCount: state.document.scenes.length,
    widgetCount: Object.keys(state.document.widgets).length,
    actionCount: Object.keys(state.document.actions).length,
    targetChannel: state.document.metadata.release.targetChannel,
    qaStatus: state.document.metadata.release.qaStatus,
    interactionTier: capabilitySummary.selectedTier,
    highestRequiredTier: capabilitySummary.highestRequiredTier,
    qualityProfile: exportModel.qualityProfile,
    exitCount: exportModel.exits.length,
    assetCount: exportModel.assets.length,
    bundledAssetCount: exportModel.assetSummary.bundledCount,
    externalAssetCount: exportModel.assetSummary.externalReferenceCount,
    blobAssetCount: exportModel.assetSummary.blobUrlCount,
    degradedWidgetCount: capabilitySummary.degraded.length,
    blockedWidgetCount: capabilitySummary.blockers.length,
    partiallyCoveredTargetCount,
    uncoveredTargetCount,
    degradedWidgets: capabilitySummary.degraded,
    blockedWidgets: capabilitySummary.blockers,
    issues,
    channelChecklist: getChannelRequirements(state.document.metadata.release.targetChannel, state),
    exportModel,
  };
}
