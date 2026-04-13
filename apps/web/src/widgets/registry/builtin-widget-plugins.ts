import type { WidgetType } from '../../domain/document/types';
import type { WidgetDefinition } from './widget-definition';

export type WidgetPluginManifestEntry = {
  type: WidgetType;
  source: string;
  definition: WidgetDefinition;
};

type DefinitionModule = Record<string, unknown>;

function isWidgetDefinition(value: unknown): value is WidgetDefinition {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WidgetDefinition>;
  return (
    typeof candidate.type === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.category === 'string'
    && typeof candidate.defaults === 'function'
    && typeof candidate.renderLabel === 'function'
  );
}

const definitionModules = import.meta.glob('../**/*.definition.ts', { eager: true }) as Record<string, DefinitionModule>;

function comparePlugins(a: WidgetPluginManifestEntry, b: WidgetPluginManifestEntry): number {
  return a.definition.label.localeCompare(b.definition.label) || a.type.localeCompare(b.type);
}

export function discoverBuiltinWidgetPlugins(): WidgetPluginManifestEntry[] {
  const byType = new Map<WidgetType, WidgetPluginManifestEntry>();

  Object.entries(definitionModules).forEach(([source, mod]) => {
    Object.values(mod).forEach((value) => {
      if (!isWidgetDefinition(value)) return;
      if (byType.has(value.type)) {
        throw new Error(`Duplicate widget definition discovered for type: ${value.type}`);
      }
      byType.set(value.type, {
        type: value.type,
        source,
        definition: value,
      });
    });
  });

  return [...byType.values()].sort(comparePlugins);
}

export const builtinWidgetPlugins = discoverBuiltinWidgetPlugins();
