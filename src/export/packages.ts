import type { StudioState } from '../domain/document/types';
import { buildStandaloneHtml } from './html';
import { buildExportManifest } from './manifest';
import { buildPackageBundle } from './package-builder';
import { buildExportReadiness } from './readiness';
import type { ExportBuildOptions } from './types';

export function buildPublishPackage(state: StudioState, options: ExportBuildOptions = {}): string {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    manifest: buildExportManifest(state, options),
    readiness: buildExportReadiness(state, options),
    collaboration: state.document.collaboration,
    document: state.document,
    html: buildStandaloneHtml(state, options),
    packageBundle: buildPackageBundle(state, options),
  }, null, 2);
}

export function buildReviewPackage(state: StudioState, options: ExportBuildOptions = {}): string {
  const openComments = state.document.collaboration.comments.filter((item) => item.status === 'open');
  const pendingApprovals = state.document.collaboration.approvals.filter((item) => item.status === 'pending');
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    document: { id: state.document.id, name: state.document.name },
    activeSceneId: state.document.selection.activeSceneId,
    summary: {
      openComments: openComments.length,
      pendingApprovals: pendingApprovals.length,
    },
    collaboration: state.document.collaboration,
    readiness: buildExportReadiness(state, options),
    manifest: buildExportManifest(state, options),
  }, null, 2);
}
