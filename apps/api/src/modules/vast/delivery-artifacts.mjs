import { getDspMacroConfig, normalizeDsp } from '@smx/contracts/dsp-macros';
import { buildScopedPublicAssetUrl } from '../storage/object-storage.mjs';

const STATIC_VAST_PUBLIC_BASE_ENVS = ['VAST_DELIVERY_PUBLIC_BASE_URL', 'ADS_PUBLIC_BASE_URL'];
const LIVE_VAST_PROFILE_DEFINITIONS = [
  { key: 'default', dsp: '', label: 'Default', aliases: ['default', 'default.xml'] },
  { key: 'basis', dsp: 'basis', label: 'Basis', aliases: ['basis', 'basis.xml'] },
  { key: 'illumin', dsp: 'illumin', label: 'Illumin', aliases: ['illumin', 'illumin.xml'] },
  { key: 'vast4', dsp: '', label: 'VAST 4.x', aliases: ['vast4', 'vast4.xml'] },
];

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
  return buildScopedPublicAssetUrl(
    buildStaticVastStorageKey(workspaceId, tagId, dsp),
    STATIC_VAST_PUBLIC_BASE_ENVS,
  ) ?? '';
}

export function buildStaticVastManifestPublicUrl(workspaceId, tagId) {
  return buildScopedPublicAssetUrl(
    buildStaticVastManifestStorageKey(workspaceId, tagId),
    STATIC_VAST_PUBLIC_BASE_ENVS,
  ) ?? '';
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

export function getLiveVastProfiles() {
  return LIVE_VAST_PROFILE_DEFINITIONS.map((profile) => ({
    key: profile.key,
    dsp: profile.dsp,
    label: profile.label,
  }));
}

export function resolveLiveVastProfile(profileKey = '') {
  const normalized = String(profileKey ?? '').trim().toLowerCase();
  return LIVE_VAST_PROFILE_DEFINITIONS.find((profile) => (
    profile.key === normalized || profile.aliases.includes(normalized)
  )) ?? null;
}

export function buildLiveVastProfileUrl(baseUrl, tagId, profileKey = 'default') {
  const profile = resolveLiveVastProfile(profileKey) ?? resolveLiveVastProfile('default');
  const normalizedBaseUrl = String(baseUrl ?? '').replace(/\/+$/, '');
  if (!normalizedBaseUrl || !tagId || !profile) return '';
  return `${normalizedBaseUrl}/v1/vast/tags/${tagId}/${profile.key}.xml`;
}
