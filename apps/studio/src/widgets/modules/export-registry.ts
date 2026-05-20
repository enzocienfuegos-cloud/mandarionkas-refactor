import type { StudioState, WidgetNode, WidgetType } from '../../domain/document/types';
import type { PortableExportWidget } from '../../export/portable';
import { getWidgetDefinition } from '../registry/widget-registry';

export type ExportChannel = StudioState['document']['metadata']['release']['targetChannel'];

export type ExportRenderContext = {
  node: PortableExportWidget;
  state: StudioState;
  assetPathMap: Record<string, string>;
  channel: ExportChannel;
};

export type ExportRenderer = (context: ExportRenderContext) => string;

export type ExportRendererManifestEntry = {
  type: WidgetType;
  render: ExportRenderer;
};

export type ExportRendererPluginManifestEntry = ExportRendererManifestEntry & {
  source: string;
};

type ExportRendererModule = Record<string, unknown>;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isExportRendererManifestEntry(value: unknown): value is ExportRendererManifestEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExportRendererManifestEntry>;
  return typeof candidate.type === 'string' && typeof candidate.render === 'function';
}

function compareRendererPlugins(a: ExportRendererPluginManifestEntry, b: ExportRendererPluginManifestEntry): number {
  return a.type.localeCompare(b.type) || a.source.localeCompare(b.source);
}

const exportRendererModules = import.meta.glob('../**/*.export.ts', { eager: true }) as Record<string, ExportRendererModule>;

export function discoverBuiltinExportRendererPlugins(): ExportRendererPluginManifestEntry[] {
  const byType = new Map<WidgetType, ExportRendererPluginManifestEntry>();

  Object.entries(exportRendererModules).forEach(([source, mod]) => {
    Object.values(mod).forEach((value) => {
      if (!isExportRendererManifestEntry(value)) return;
      if (byType.has(value.type)) {
        throw new Error(`Duplicate export renderer discovered for type: ${value.type}`);
      }
      byType.set(value.type, {
        type: value.type,
        source,
        render: value.render,
      });
    });
  });

  return [...byType.values()].sort(compareRendererPlugins);
}

export const builtinExportRendererPlugins = discoverBuiltinExportRendererPlugins();

const builtinExportRenderers = new Map(
  builtinExportRendererPlugins.map((plugin) => [plugin.type, plugin.render] as const),
);

const exportRendererOverrides = new Map<WidgetType, ExportRenderer>();

export function registerExportRenderer(type: WidgetType, renderer: ExportRenderer): void {
  exportRendererOverrides.set(type, renderer);
}

export function clearExportRendererOverrides(): void {
  exportRendererOverrides.clear();
}

export function hasExportRenderer(type: WidgetType): boolean {
  return exportRendererOverrides.has(type) || builtinExportRenderers.has(type);
}

export function getExportRenderer(type: WidgetType): ExportRenderer | null {
  return exportRendererOverrides.get(type) ?? builtinExportRenderers.get(type) ?? null;
}

export function renderLegacyWidgetExport(context: ExportRenderContext): string {
  const definition = getWidgetDefinition(context.node.type);
  if (definition.renderExport) {
    return definition.renderExport(context.node as unknown as WidgetNode, context.state, context.assetPathMap);
  }

  const frame = context.node.frame;
  const style = context.node.style ?? {};
  const base = [
    'position:absolute',
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    'overflow:hidden',
    'box-sizing:border-box',
    'background:transparent',
    'border:none',
    'pointer-events:none',
  ].join(';');

  return `<div class="widget widget-module" data-widget-id="${context.node.id}" style="${base}"></div>`;
}

export function renderWidgetExport(context: ExportRenderContext): string {
  return getExportRenderer(context.node.type)?.(context) ?? renderLegacyWidgetExport(context);
}
