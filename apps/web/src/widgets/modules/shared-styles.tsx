import type { CSSProperties, ReactNode } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { parseShoppableProducts } from './shoppable-sidebar.shared';

export const resolveWidgetColor = (node: WidgetNode, ctx?: RenderContext): string => {
  if (ctx?.active && node.style.activeColor) return String(node.style.activeColor);
  if (ctx?.hovered && node.style.hoverColor) return String(node.style.hoverColor);
  return String(node.style.color ?? '#fff');
};
export const resolveWidgetBackground = (node: WidgetNode, fallback: string, ctx?: RenderContext): string => {
  if (ctx?.active && node.style.activeBackgroundColor) return String(node.style.activeBackgroundColor);
  if (ctx?.hovered && node.style.hoverBackgroundColor) return String(node.style.hoverBackgroundColor);
  return String(node.style.backgroundColor ?? fallback);
};
export const resolveWidgetBorder = (node: WidgetNode, ctx?: RenderContext): string => {
  if (ctx?.active && node.style.activeBorderColor) return String(node.style.activeBorderColor);
  if (ctx?.hovered && node.style.hoverBorderColor) return String(node.style.hoverBorderColor);
  if (ctx?.hovered) return String(node.style.accentColor ?? '#f59e0b');
  return 'rgba(255,255,255,0.12)';
};
export const resolveWidgetOpacity = (node: WidgetNode, ctx?: RenderContext): number => {
  if (ctx?.active && node.style.activeOpacity != null) return Number(node.style.activeOpacity);
  if (ctx?.hovered && node.style.hoverOpacity != null) return Number(node.style.hoverOpacity);
  return Number(node.style.opacity ?? 1);
};
export const resolveWidgetShadow = (node: WidgetNode, ctx?: RenderContext): string => {
  if (ctx?.active && node.style.activeShadow) return String(node.style.activeShadow);
  if (ctx?.hovered && node.style.hoverShadow) return String(node.style.hoverShadow);
  return ctx?.hovered ? '0 18px 34px rgba(0,0,0,0.28)' : '0 14px 30px rgba(0,0,0,0.18)';
};
export const moduleShellEdit = (node: WidgetNode): CSSProperties => ({
  width: '100%',
  height: '100%',
  borderRadius: Number(node.style.borderRadius ?? 14),
  background: String(node.style.backgroundColor ?? '#1f2937'),
  color: String(node.style.color ?? '#ffffff'),
  border: `1px solid ${String(node.style.borderColor ?? `${String(node.style.accentColor ?? '#94a3b8')}33`)}`,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 10px 20px rgba(0,0,0,0.08)',
  opacity: Number(node.style.opacity ?? 1),
  transition: 'none',
});
export const moduleShell = (node: WidgetNode, ctx?: RenderContext): CSSProperties => (
  !ctx?.previewMode
    ? moduleShellEdit(node)
    : {
      width: '100%',
      height: '100%',
      borderRadius: 14,
      background: resolveWidgetBackground(node, '#1f2937', ctx),
      color: resolveWidgetColor(node, ctx),
      border: `1px solid ${resolveWidgetBorder(node, ctx)}`,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: resolveWidgetShadow(node, ctx),
      opacity: resolveWidgetOpacity(node, ctx),
      transition: 'box-shadow .16s ease, border-color .16s ease, transform .16s ease, opacity .16s ease',
      transform: ctx?.hovered ? 'translateY(-1px)' : 'none',
    }
);
export const moduleHeader = (node: WidgetNode): CSSProperties => ({
  padding: '10px 12px 0', fontSize: 12, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: String(node.style.accentColor ?? node.style.color ?? '#f59e0b'),
});
export const moduleBody: CSSProperties = { padding: '8px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 };
export function StatChip({ children, accent }: { children: ReactNode; accent: string }): JSX.Element { return <div style={{ borderRadius: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.08)', border: `1px solid ${accent}` }}>{children}</div>; }
export function getAccent(node: WidgetNode): string { return String(node.style.accentColor ?? '#f59e0b'); }
export function clamp(v:number,min:number,max:number){ return Math.max(min, Math.min(max, v)); }
export function formatQrSeed(url:string){ return url.split('').reduce((a,c)=>a + c.charCodeAt(0),0); }
export function buildQrPattern(url:string){ const seed=formatQrSeed(url||'smx'); return Array.from({length:81}, (_,i)=> ((seed + i*17 + Math.floor(i/9)*13)%5)<2); }
export type CsvMarker = { name: string; flag: string; lat: number; lng: number };
export function parseCsvMarkers(csv: string): CsvMarker[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) return [];
  const header = lines[0].split(',').map((item) => item.trim().toLowerCase());
  const nameIndex = header.indexOf('name');
  const flagIndex = header.indexOf('flag');
  const latIndex = header.findIndex((value) => value === 'lat' || value === 'latitude');
  const lngIndex = header.findIndex((value) => value === 'lng' || value === 'lon' || value === 'longitude');
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((item) => item.trim());
    return { name: cols[nameIndex] ?? 'Pin', flag: cols[flagIndex] ?? '', lat: Number(cols[latIndex]), lng: Number(cols[lngIndex]) };
  }).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}
export function getFlagEmoji(flagCode: string): string {
  const code = flagCode.trim().toUpperCase(); if (!/^[A-Z]{2}$/.test(code)) return '📍'; return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}
export function parseCarouselSlides(raw: string): Array<{ src: string; caption: string }> {
  return raw.split(';').map((item) => item.trim()).filter(Boolean).map((item, index) => { const [src, caption] = item.split('|'); return { src: (src ?? '').trim(), caption: (caption ?? `Slide ${index + 1}`).trim() }; }).filter((item) => item.src);
}
const COLLAPSIBLE_EDITOR_WIDGETS = new Set<WidgetNode['type']>([]);
function editorSummary(node: WidgetNode): string[] {
  switch (node.type) {
    case 'dynamic-map': { const markers = parseCsvMarkers(String(node.props.markersCsv ?? '')); return [`${markers.length || 1} marker${markers.length === 1 ? '' : 's'}`, `Zoom ${clamp(Number(node.props.zoom ?? 13), 2, 18)}`, `Provider ${String(node.props.provider ?? 'osm')}`]; }
    case 'weather-conditions': return [`${String(node.props.location ?? 'Location')}`, `${String(node.props.condition ?? 'Condition')} · ${String(node.props.temperature ?? '--')}°`, String(node.props.liveWeather ? 'Live weather' : 'Static preview')];
    case 'form': return [`${String(node.props.fieldOne ?? 'Name')} + ${String(node.props.fieldTwo ?? 'Email')}`, `Submit ${String(node.props.submitTargetType ?? 'none')}`];
    case 'image-carousel': { const slides = parseCarouselSlides(String(node.props.slides ?? '')); return [`${slides.length} slides`, String(node.props.autoplay ? 'Autoplay on' : 'Autoplay off')]; }
    case 'shoppable-sidebar': { const products = parseShoppableProducts(String(node.props.products ?? '')); return [`${products.length || 1} products`, `${String(node.props.orientation ?? 'horizontal')} layout`, String(node.props.autoscroll ? 'Autoscroll on' : 'Autoscroll off')]; }
    default: return [String(node.props.title ?? node.name)];
  }
}
function useCollapsedEditorWidget(node: WidgetNode, ctx: RenderContext): boolean { return !ctx.previewMode && COLLAPSIBLE_EDITOR_WIDGETS.has(node.type); }
function CollapsedEditorModule({ node }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node); const summary = editorSummary(node).filter(Boolean).slice(0, 3);
  return <div style={moduleShellEdit(node)}><div style={{ ...moduleHeader(node), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 10 }}><span>{String(node.props.title ?? node.name)}</span><span style={{ fontSize: 11, opacity: 0.78 }}>{node.type}</span></div><div style={{ ...moduleBody, justifyContent: 'space-between', gap: 8 }}><div style={{ display: 'grid', gap: 8 }}>{summary.map((item, index) => <div key={`${node.id}-summary-${index}`} style={{ borderRadius: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', border: `1px dashed ${accent}66`, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item}</div>)}</div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 11, opacity: 0.68 }}><span>Wireframe</span><span>Config in inspector</span></div></div></div>;
}
export function renderCollapsedIfNeeded(node: WidgetNode, ctx: RenderContext): JSX.Element | null { return useCollapsedEditorWidget(node, ctx) ? <CollapsedEditorModule node={node} ctx={ctx} /> : null; }
