import { useEffect, useMemo, useState } from 'react';
import { buildDiagnosticSummary } from '../../../domain/document/diagnostics';
import { validateExport } from '../../../domain/document/export-validation';
import { buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPackageFiles, triggerExportPublishPackage, triggerExportReviewPackage } from '../../../export/engine';
import { listAssets } from '../../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../../repositories/asset/events';
import type { ExportBuildOptions, ExportLinkedAsset } from '../../../export/types';
import type { ExportReadinessController, TopBarStudioSnapshot } from './top-bar-types';

export function useExportReadinessController(snapshot: TopBarStudioSnapshot): ExportReadinessController {
  const [qualityProfile, setQualityProfile] = useState<'high' | 'medium' | 'low'>('medium');
  const [linkedAssets, setLinkedAssets] = useState<ExportLinkedAsset[]>([]);

  useEffect(() => {
    let cancelled = false;
    const syncAssets = () => {
      void listAssets()
        .then((records) => {
          if (!cancelled) setLinkedAssets(records);
        })
        .catch(() => {
          if (!cancelled) setLinkedAssets([]);
        });
    };

    syncAssets();
    const unsubscribe = subscribeToAssetLibraryChanges(syncAssets);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  function mergeExportOptions(options: ExportBuildOptions = {}): ExportBuildOptions {
    return {
      ...options,
      linkedAssets,
    };
  }

  const readiness = useMemo(
    () => buildExportReadiness(snapshot.state, mergeExportOptions({ qualityProfile })),
    [snapshot.state, qualityProfile, linkedAssets],
  );

  return {
    qualityProfile,
    setQualityProfile,
    exportIssues: validateExport(snapshot.state),
    readiness,
    diagnostics: buildDiagnosticSummary(snapshot.state),
    triggerExportHtml(state, options) {
      triggerExportHtml(state, mergeExportOptions(options));
    },
    triggerExportManifest(state, options) {
      triggerExportManifest(state, mergeExportOptions(options));
    },
    triggerExportDocumentJson,
    triggerExportPackageFiles(state, options) {
      triggerExportPackageFiles(state, mergeExportOptions(options));
    },
    triggerExportPublishPackage(state, options) {
      triggerExportPublishPackage(state, mergeExportOptions(options));
    },
    triggerExportReviewPackage(state, options) {
      triggerExportReviewPackage(state, mergeExportOptions(options));
    },
  };
}
