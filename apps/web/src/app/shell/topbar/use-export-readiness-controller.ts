import { buildDiagnosticSummary } from '../../../domain/document/diagnostics';
import { validateExport } from '../../../domain/document/export-validation';
import { buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPublishPackage, triggerExportReviewPackage } from '../../../export/engine';
import type { ExportReadinessController, TopBarStudioSnapshot } from './top-bar-types';

export function useExportReadinessController(snapshot: TopBarStudioSnapshot): ExportReadinessController {
  return {
    exportIssues: validateExport(snapshot.state),
    readiness: buildExportReadiness(snapshot.state),
    diagnostics: buildDiagnosticSummary(snapshot.state),
    triggerExportHtml,
    triggerExportManifest,
    triggerExportDocumentJson,
    triggerExportPublishPackage,
    triggerExportReviewPackage,
  };
}
