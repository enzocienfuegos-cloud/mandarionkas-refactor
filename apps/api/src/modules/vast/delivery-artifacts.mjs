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

export function buildStaticVastPublicUrl(workspaceId, tagId, dsp = '') {
  return buildPublicAssetUrl(buildStaticVastStorageKey(workspaceId, tagId, dsp)) ?? '';
}

export function buildStaticVastTemplateQuery(dsp = '') {
  const config = getDspMacroConfig(dsp);
  if (!config) return {};
  return { ...config.queryParams };
}
