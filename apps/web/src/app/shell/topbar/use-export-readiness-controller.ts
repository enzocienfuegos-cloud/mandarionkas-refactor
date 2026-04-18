import { useState } from 'react';
import { buildDiagnosticSummary } from '../../../domain/document/diagnostics';
import { validateExport } from '../../../domain/document/export-validation';
import { buildExportHandoff, buildExportPreflight, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPreflight, triggerExportPublishPackage, triggerExportReviewPackage, triggerExportZipBundle, triggerExportZipBundleResolved } from '../../../export/engine';
import type { ExportReadinessController, TopBarStudioSnapshot } from './top-bar-types';

function channelExportLabel(target: TopBarStudioSnapshot['state']['document']['metadata']['release']['targetChannel']): string {
  switch (target) {
    case 'mraid':
      return 'MRAID ZIP';
    case 'google-display':
      return 'Google Display ZIP';
    case 'gam-html5':
      return 'GAM HTML5 ZIP';
    case 'meta-story':
      return 'Meta Story ZIP';
    case 'tiktok-vertical':
      return 'TikTok Vertical ZIP';
    case 'generic-html5':
    default:
      return 'IAB HTML5 ZIP';
  }
}

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
