import type { StudioState } from '../domain/document/types';
import { buildExportBundle, buildExportBundleWithRemoteAssets } from './bundle';
import { buildExportPreflight } from './preflight';
import { buildStandaloneHtml } from './html';
import { buildExportManifest } from './manifest';
import { buildPublishPackage, buildReviewPackage } from './packages';
import { buildZipFromBundle } from './zip';

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function triggerExportHtml(state: StudioState): void {
  downloadTextFile(`${state.document.name || 'smx-export'}.html`, buildStandaloneHtml(state), 'text/html;charset=utf-8');
}

export function triggerExportManifest(state: StudioState): void {
  downloadTextFile(`${state.document.name || 'smx-export'}-manifest.json`, JSON.stringify(buildExportManifest(state), null, 2), 'application/json;charset=utf-8');
}

export function triggerExportPreflight(state: StudioState): void {
  downloadTextFile(`${state.document.name || 'smx-export'}-preflight.json`, JSON.stringify(buildExportPreflight(state), null, 2), 'application/json;charset=utf-8');
}

export function triggerExportDocumentJson(state: StudioState): void {
  downloadTextFile(`${state.document.name || 'smx-export'}-document.json`, JSON.stringify(state.document, null, 2), 'application/json;charset=utf-8');
}

export function triggerExportPublishPackage(state: StudioState): void {
  downloadTextFile(`${state.document.name || 'smx-export'}-publish-package.json`, buildPublishPackage(state), 'application/json;charset=utf-8');
}

export function triggerExportReviewPackage(state: StudioState): void {
  downloadTextFile(`${state.document.name || 'smx-export'}-review-package.json`, buildReviewPackage(state), 'application/json;charset=utf-8');
}

export function triggerExportZipBundle(state: StudioState): void {
  const bundle = buildExportBundle(state);
  const zip = buildZipFromBundle(bundle, state.document.name || 'smx-export');
  downloadBlob(zip.filename, new Blob([zip.bytes], { type: zip.mime }));
}

export async function triggerExportZipBundleResolved(state: StudioState): Promise<string> {
  const bundle = await buildExportBundleWithRemoteAssets(state);
  const zip = buildZipFromBundle(bundle, state.document.name || 'smx-export');
  downloadBlob(zip.filename, new Blob([zip.bytes], { type: zip.mime }));
  return zip.filename;
}
