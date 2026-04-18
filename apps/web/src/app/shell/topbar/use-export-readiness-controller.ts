import { useState } from 'react';
import { buildDiagnosticSummary } from '../../../domain/document/diagnostics';
import { validateExport } from '../../../domain/document/export-validation';
import { buildExportPreflight, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPreflight, triggerExportPublishPackage, triggerExportReviewPackage, triggerExportZipBundle, triggerExportZipBundleResolved } from '../../../export/engine';
import type { ExportReadinessController, TopBarStudioSnapshot } from './top-bar-types';

export function useExportReadinessController(snapshot: TopBarStudioSnapshot): ExportReadinessController {
  const [resolvedZipStatus, setResolvedZipStatus] = useState<ExportReadinessController['resolvedZipStatus']>('idle');
  const [resolvedZipMessage, setResolvedZipMessage] = useState<string | undefined>(undefined);

  async function handleResolvedZipExport(state: TopBarStudioSnapshot['state']): Promise<void> {
    setResolvedZipStatus('exporting');
    setResolvedZipMessage('Resolving remote assets…');
    try {
      const filename = await triggerExportZipBundleResolved(state);
      setResolvedZipStatus('success');
      setResolvedZipMessage(`Resolved ZIP ready: ${filename}`);
    } catch (error) {
      setResolvedZipStatus('error');
      setResolvedZipMessage(error instanceof Error ? error.message : 'Resolved ZIP export failed.');
    }
  }

  return {
    exportIssues: validateExport(snapshot.state),
    readiness: buildExportReadiness(snapshot.state),
    preflight: buildExportPreflight(snapshot.state),
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
