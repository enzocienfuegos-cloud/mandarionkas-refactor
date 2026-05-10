import type { StudioTemplateMetadata } from './types';

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const VERTICAL_GRADIENTS: Record<StudioTemplateMetadata['vertical'], [string, string]> = {
  auto: ['#10203A', '#1F7AE0'],
  cpg: ['#3B1C6B', '#F97316'],
  custom: ['#0F172A', '#7C3AED'],
  ecommerce: ['#112032', '#16A34A'],
  finance: ['#082F49', '#0891B2'],
  sports: ['#0F172A', '#1D4ED8'],
};

export function buildTemplateThumbnailDataUrl(metadata: StudioTemplateMetadata): string {
  const [from, to] = VERTICAL_GRADIENTS[metadata.vertical] ?? VERTICAL_GRADIENTS.custom;
  const sceneLabel = `${metadata.sceneCount ?? 1} scenes`;
  const highlightLabel = (metadata.moduleHighlights ?? metadata.tags ?? []).slice(0, 2).join(' · ') || metadata.vertical;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${from}" />
          <stop offset="100%" stop-color="${to}" />
        </linearGradient>
      </defs>
      <rect width="320" height="220" rx="28" fill="url(#bg)" />
      <rect x="24" y="24" width="94" height="26" rx="13" fill="rgba(255,255,255,0.12)" />
      <text x="40" y="41" fill="#67E8F9" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="12" letter-spacing="1.2">${escape(metadata.vertical.toUpperCase())}</text>
      <text x="24" y="100" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="28">${escape(metadata.name)}</text>
      <text x="24" y="128" fill="rgba(255,255,255,0.72)" font-family="Inter, Arial, sans-serif" font-weight="600" font-size="14">${escape(sceneLabel)}</text>
      <rect x="24" y="152" width="272" height="44" rx="18" fill="rgba(255,255,255,0.12)" />
      <text x="40" y="179" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-weight="600" font-size="14">${escape(highlightLabel)}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
