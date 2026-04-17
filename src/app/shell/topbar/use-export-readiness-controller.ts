import { useMemo, useState } from 'react';
import { buildDiagnosticSummary } from '../../../domain/document/diagnostics';
import { validateExport } from '../../../domain/document/export-validation';
import { buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPackageFiles, triggerExportPublishPackage, triggerExportReviewPackage } from '../../../export/engine';
import type { ExportReadinessController, TopBarStudioSnapshot } from './top-bar-types';

export function useExportReadinessController(snapshot: TopBarStudioSnapshot): ExportReadinessController {
  const [qualityProfile, setQualityProfile] = useState<'high' | 'medium' | 'low'>('medium');
  const readiness = useMemo(
    () => buildExportReadiness(snapshot.state, { qualityProfile }),
    [snapshot.state, qualityProfile],
  );

  return {
    qualityProfile,
    setQualityProfile,
    exportIssues: validateExport(snapshot.state),
    readiness,
    diagnostics: buildDiagnosticSummary(snapshot.state),
    triggerExportHtml,
    triggerExportManifest,
    triggerExportDocumentJson,
    triggerExportPackageFiles,
    triggerExportPublishPackage,
    triggerExportReviewPackage,
  };
}
