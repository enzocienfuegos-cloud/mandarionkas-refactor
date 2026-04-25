import { getDspMacroConfig, normalizeDsp } from '@smx/contracts/dsp-macros';
import { buildPublicAssetUrl } from '../storage/object-storage.mjs';

export function buildStaticVastProfile(dsp = '') {
  const normalizedDsp = normalizeDsp(dsp);
  return normalizedDsp || 'default';
}

export function buildStaticVastStorageKey(workspaceId, tagId, dsp = '') {
  const profile = buildStaticVastProfile(dsp);
  return `${workspaceId}/tag-delivery/vast/${tagId}/${profile}.xml`;
}

export function buildStaticVastManifestStorageKey(workspaceId, tagId) {
  return `${workspaceId}/tag-delivery/vast/${tagId}/manifest.json`;
}

export function buildStaticVastPublicUrl(workspaceId, tagId, dsp = '') {
  return buildPublicAssetUrl(buildStaticVastStorageKey(workspaceId, tagId, dsp)) ?? '';
}

export function buildStaticVastManifestPublicUrl(workspaceId, tagId) {
  return buildPublicAssetUrl(buildStaticVastManifestStorageKey(workspaceId, tagId)) ?? '';
}

export function buildStaticVastTemplateQuery(dsp = '') {
  const config = getDspMacroConfig(dsp);
  if (!config) return {};
  return { ...config.queryParams };
}

export function getStaticVastProfiles() {
  return [
    { key: 'default', dsp: '', label: 'Default' },
    { key: 'basis', dsp: 'basis', label: 'Basis' },
    { key: 'illumin', dsp: 'illumin', label: 'Illumin' },
  ];
}
