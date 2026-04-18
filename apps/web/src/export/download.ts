import type { StudioState } from '../domain/document/types';
import { prepareExportStateWithResolvedAssets } from './asset-resolution';
import { buildStandaloneHtml } from './html';
import { buildExportManifest } from './manifest';
import { buildPublishPackage, buildReviewPackage } from './packages';

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function triggerExportHtml(state: StudioState): Promise<void> {
  const preparedState = await prepareExportStateWithResolvedAssets(state);
  downloadTextFile(`${state.document.name || 'smx-export'}.html`, buildStandaloneHtml(preparedState), 'text/html;charset=utf-8');
}

export function triggerExportManifest(state: StudioState): void {
  downloadTextFile(`${state.document.name || 'smx-export'}-manifest.json`, JSON.stringify(buildExportManifest(state), null, 2), 'application/json;charset=utf-8');
}

export function triggerExportDocumentJson(state: StudioState): void {
  downloadTextFile(`${state.document.name || 'smx-export'}-document.json`, JSON.stringify(state.document, null, 2), 'application/json;charset=utf-8');
}

export async function triggerExportPublishPackage(state: StudioState): Promise<void> {
  const preparedState = await prepareExportStateWithResolvedAssets(state);
  downloadTextFile(
    `${state.document.name || 'smx-export'}-publish-package.json`,
    buildPublishPackage(state, preparedState),
    'application/json;charset=utf-8',
  );
}

export function triggerExportReviewPackage(state: StudioState): void {
  downloadTextFile(`${state.document.name || 'smx-export'}-review-package.json`, buildReviewPackage(state), 'application/json;charset=utf-8');
}
