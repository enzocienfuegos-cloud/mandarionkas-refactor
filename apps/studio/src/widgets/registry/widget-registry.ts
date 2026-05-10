import type { WidgetDefinition } from './widget-definition';
import type { WidgetType } from '../../domain/document/types';
import type { WidgetPluginManifestEntry } from './builtin-widget-plugins';
import { withWidgetLibraryMetadata } from './widget-library-taxonomy';

const registry = new Map<WidgetType, WidgetDefinition>();

export function registerWidget(definition: WidgetDefinition): void {
  registry.set(definition.type, withWidgetLibraryMetadata(definition));
}

export function registerWidgetPlugins(plugins: WidgetPluginManifestEntry[]): void {
  plugins.forEach((plugin) => registerWidget(plugin.definition));
}

export function hasWidgetDefinition(type: WidgetType): boolean {
  return registry.has(type);
}

export function clearWidgetRegistry(): void {
  registry.clear();
}

export function getWidgetDefinition(type: WidgetType): WidgetDefinition {
  const definition = registry.get(type);
  if (!definition) {
    throw new Error(`Widget definition not found for type: ${type}`);
  }
  return definition;
}

export function listWidgetDefinitions(): WidgetDefinition[] {
  return [...registry.values()].sort((a, b) => {
    const aRank = a.libraryRank ?? Number.MAX_SAFE_INTEGER;
    const bRank = b.libraryRank ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank || a.label.localeCompare(b.label) || a.type.localeCompare(b.type);
  });
}
