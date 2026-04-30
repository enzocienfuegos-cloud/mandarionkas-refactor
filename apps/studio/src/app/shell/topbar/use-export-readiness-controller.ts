import { useState } from 'react';
import { buildDiagnosticSummary } from '../../../domain/document/diagnostics';
import { validateExport } from '../../../domain/document/export-validation';
import { buildExportHandoff, buildExportPreflight, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPreflight, triggerExportPublishPackage, triggerExportReviewPackage, triggerExportZipBundle, triggerExportZipBundleResolved } from '../../../export/engine';
import type { ExportReadinessController, TopBarStudioSnapshot } from './top-bar-types';
import { channelExportLabel } from './export-channels';

export function useExportReadinessController(snapshot: TopBarStudioSnapshot): ExportReadinessController {
  const [resolvedZipStatus, setResolvedZipStatus] = useState<ExportReadinessController['resolvedZipStatus']>('idle');
  const [resolvedZipMessage, setResolvedZipMessage] = useState<string | undefined>(undefined);

  async function handleResolvedZipExport(state: TopBarStudioSnapshot['state']): Promise<void> {
    const exportLabel = channelExportLabel(state.document.metadata.release.targetChannel);
    setResolvedZipStatus('exporting');
    setResolvedZipMessage(`Building ${exportLabel}…`);
    try {
      const filename = await triggerExportZipBundleResolved(state);
      setResolvedZipStatus('success');
      setResolvedZipMessage(`${exportLabel} ready: ${filename}`);
    } catch (error) {
      setResolvedZipStatus('error');
      setResolvedZipMessage(error instanceof Error ? error.message : `${exportLabel} export failed.`);
    }
  }

  return {
    exportIssues: validateExport(snapshot.state),
    readiness: buildExportReadiness(snapshot.state),
    preflight: buildExportPreflight(snapshot.state),
    handoff: buildExportHandoff(snapshot.state),
    diagnostics: buildDiagnosticSummary(snapshot.state),
    resolvedZipStatus,
    resolvedZipMessage,
    triggerExportHtml,
    triggerExportManifest,
    triggerExportPreflight,
    triggerExportDocumentJson,
    triggerExportPublishPackage,
    triggerExportReviewPackage,
    triggerExportZipBundle,
    triggerExportZipBundleResolved: handleResolvedZipExport,
  };
}
