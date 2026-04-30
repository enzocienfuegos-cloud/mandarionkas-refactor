import { describe, expect, it } from 'vitest';
import { builtinWidgetPlugins } from '../../../widgets/registry/builtin-widget-plugins';
import { clearWidgetRegistry, getWidgetDefinition, hasWidgetDefinition, registerWidgetPlugins } from '../../../widgets/registry/widget-registry';

describe('widget plugin manifest', () => {
  it('discovers unique widget definitions with source metadata', () => {
    const types = builtinWidgetPlugins.map((plugin) => plugin.type);
    expect(types.length).toBeGreaterThan(5);
    expect(new Set(types).size).toBe(types.length);
    expect(builtinWidgetPlugins.every((plugin) => plugin.source.endsWith('.definition.ts'))).toBe(true);
  });

  it('registers plugins without manual per-widget wiring', () => {
    clearWidgetRegistry();
    registerWidgetPlugins(builtinWidgetPlugins);

    expect(hasWidgetDefinition('text')).toBe(true);
    expect(hasWidgetDefinition('badge')).toBe(true);
    expect(hasWidgetDefinition('countdown')).toBe(true);
    expect(getWidgetDefinition('badge').label).toBe('Badge');
  });
});
