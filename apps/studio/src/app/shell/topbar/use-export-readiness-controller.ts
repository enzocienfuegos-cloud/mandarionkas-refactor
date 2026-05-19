import { useCallback, useMemo, useRef, useState } from 'react';
import { buildDiagnosticSummary } from '../../../domain/document/diagnostics';
import { validateExport } from '../../../domain/document/export-validation';
import { buildExportHandoff, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPreflight, triggerExportPublishPackage, triggerExportReviewPackage, triggerExportZipBundle, triggerExportZipBundleResolved } from '../../../export/engine';
import type { ExportReadinessController, TopBarStudioSnapshot } from './top-bar-types';
import { channelExportLabel } from './export-channels';

export function useExportReadinessController(snapshot: TopBarStudioSnapshot): ExportReadinessController {
  const [resolvedZipStatus, setResolvedZipStatus] = useState<ExportReadinessController['resolvedZipStatus']>('idle');
  const [resolvedZipMessage, setResolvedZipMessage] = useState<string | undefined>(undefined);
  const stateRef = useRef(snapshot.state);
  stateRef.current = snapshot.state;
  const exportIssues = useMemo(() => validateExport(snapshot.state), [snapshot.state.document]);
  const getReadiness = useCallback(() => buildExportReadiness(stateRef.current), []);
  const getHandoff = useCallback(() => buildExportHandoff(stateRef.current), []);
  const getDiagnostics = useCallback(() => buildDiagnosticSummary(stateRef.current), []);

  async function handleResolvedZipExport(state: TopBarStudioSnapshot['state']): Promise<void> {
    const exportLabel = state.document.canvasVariants.length > 1
      ? `${channelExportLabel(state.document.metadata.release.targetChannel)} size set`
      : channelExportLabel(state.document.metadata.release.targetChannel);
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
    exportIssues,
    getReadiness,
    getHandoff,
    getDiagnostics,
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
