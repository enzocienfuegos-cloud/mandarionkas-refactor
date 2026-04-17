import type { StudioState } from '../domain/document/types';
import { buildStandaloneHtml } from './html';
import { buildExportManifest } from './manifest';
import { buildPackageBundle } from './package-builder';
import { buildPublishPackage, buildReviewPackage } from './packages';
import type { ExportBuildOptions } from './types';

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadPackageFiles(prefix: string, files: Array<{ path: string; content: string; mime: string }>): void {
  files.forEach((file, index) => {
    window.setTimeout(() => {
      const safePrefix = prefix.trim() || 'dusk-export';
      const filename = `${safePrefix}-${file.path.replace(/\//g, '-')}`;
      downloadTextFile(filename, file.content, file.mime);
    }, index * 120);
  });
}

export function triggerExportHtml(state: StudioState, options: ExportBuildOptions = {}): void {
  downloadTextFile(`${state.document.name || 'smx-export'}.html`, buildStandaloneHtml(state, options), 'text/html;charset=utf-8');
}

export function triggerExportManifest(state: StudioState, options: ExportBuildOptions = {}): void {
  downloadTextFile(`${state.document.name || 'smx-export'}-manifest.json`, JSON.stringify(buildExportManifest(state, options), null, 2), 'application/json;charset=utf-8');
}

export function triggerExportDocumentJson(state: StudioState): void {
  downloadTextFile(`${state.document.name || 'smx-export'}-document.json`, JSON.stringify(state.document, null, 2), 'application/json;charset=utf-8');
}

export function triggerExportPublishPackage(state: StudioState, options: ExportBuildOptions = {}): void {
  downloadTextFile(`${state.document.name || 'smx-export'}-publish-package.json`, buildPublishPackage(state, options), 'application/json;charset=utf-8');
}

export function triggerExportReviewPackage(state: StudioState, options: ExportBuildOptions = {}): void {
  downloadTextFile(`${state.document.name || 'smx-export'}-review-package.json`, buildReviewPackage(state, options), 'application/json;charset=utf-8');
}

export function triggerExportPackageFiles(state: StudioState, options: ExportBuildOptions = {}): void {
  const bundle = buildPackageBundle(state, options);
  downloadPackageFiles(state.document.name || 'dusk-package', bundle.files);
}
