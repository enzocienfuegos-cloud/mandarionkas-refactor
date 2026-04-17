import { validateExport } from '../domain/document/export-validation';
import type { StudioState } from '../domain/document/types';
import { resolveExportCapabilities } from './capabilities';
import { getChannelRequirements } from './channels';
import { buildExportModel } from './model';
import type { ExportBuildOptions, ExportReadiness } from './types';

export function buildExportReadiness(state: StudioState, options: ExportBuildOptions = {}): ExportReadiness {
  const issues = validateExport(state);
  const capabilitySummary = resolveExportCapabilities(state);
  const exportModel = buildExportModel(state, options);
  const targetCoverageWarnings = exportModel.targetCoverage.filter((item) => item.coverage !== 'full');
  const externalAssetWarnings = exportModel.assetSummary.externalReferenceCount;
  const blobAssetWarnings = exportModel.assetSummary.blobUrlCount;
  const degradedWithoutStrategy = capabilitySummary.degraded.filter((item) => !item.degradationStrategy);
  const blockers = issues.filter((item) => item.level === 'error').length + capabilitySummary.blockers.length;
  const warnings = issues.filter((item) => item.level === 'warning').length + capabilitySummary.degraded.length + targetCoverageWarnings.length + externalAssetWarnings + blobAssetWarnings + degradedWithoutStrategy.length;
  const targetChannel = state.document.metadata.release.targetChannel;
  const channelChecklist = getChannelRequirements(targetChannel, state);
  const checklist = [
    { label: 'Document has a name', passed: Boolean(state.document.name.trim()) },
    { label: 'At least one scene exists', passed: state.document.scenes.length > 0 },
    { label: 'Every scene has widgets', passed: state.document.scenes.every((scene) => scene.widgetIds.length > 0) },
    { label: 'All widget frames are valid', passed: Object.values(state.document.widgets).every((widget) => widget.frame.width > 0 && widget.frame.height > 0) },
    { label: 'CTA widgets have URLs', passed: Object.values(state.document.widgets).filter((widget) => widget.type === 'cta').every((widget) => Object.values(state.document.actions).some((action) => action.widgetId === widget.id && action.type === 'open-url' && action.url)) },
    { label: 'QA status is ready-for-qa or passed', passed: state.document.metadata.release.qaStatus !== 'draft' },
    { label: 'Selected interaction tier supports this creative', passed: capabilitySummary.blockers.length === 0 && capabilitySummary.highestRequiredTier === capabilitySummary.selectedTier },
    { label: 'Responsive multi-exit banner runtime is enabled', passed: capabilitySummary.selectedTier === 'banner-runtime' },
    { label: 'Degraded widgets expose explicit fallback strategies', passed: degradedWithoutStrategy.length === 0 },
    { label: 'Multi-target widgets have complete exit coverage', passed: targetCoverageWarnings.length === 0 },
    { label: 'Assets are packaged without unresolved external references', passed: exportModel.assetSummary.externalReferenceCount === 0 },
    { label: 'No blob-based assets remain unresolved', passed: exportModel.assetSummary.blobUrlCount === 0 },
    ...channelChecklist.map((item) => ({ label: item.label, passed: item.passed })),
    { label: 'No export blockers', passed: blockers === 0 },
  ];
  const passedCount = checklist.filter((item) => item.passed).length;
  const rawScore = Math.round((passedCount / checklist.length) * 100 - warnings * 2 - blockers * 15);
  const score = Math.max(0, Math.min(100, rawScore));
  const grade: ExportReadiness['grade'] = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  return {
    score,
    grade,
    blockers,
    warnings,
    checklist,
    targetChannel,
    qaStatus: state.document.metadata.release.qaStatus,
    interactionTier: capabilitySummary.selectedTier,
    highestRequiredTier: capabilitySummary.highestRequiredTier,
    qualityProfile: exportModel.qualityProfile,
    capabilitySummary,
    targetCoverage: exportModel.targetCoverage,
    assetSummary: exportModel.assetSummary,
    degradedWidgets: capabilitySummary.degraded,
    blockedWidgets: capabilitySummary.blockers,
  };
}
