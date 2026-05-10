import { describe, expect, it, vi } from 'vitest';
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

  it('discovers manifests without eagerly importing heavy widget runtimes', async () => {
    vi.resetModules();
    vi.doMock('../../../widgets/modules/dynamic-map.renderer', () => {
      throw new Error('dynamic-map renderer imported eagerly');
    });
    vi.doMock('../../../widgets/modules/dynamic-map.inspector', () => {
      throw new Error('dynamic-map inspector imported eagerly');
    });
    vi.doMock('../../../widgets/modules/interactive-video.renderer', () => {
      throw new Error('interactive-video renderer imported eagerly');
    });
    vi.doMock('../../../widgets/modules/interactive-video.inspector', () => {
      throw new Error('interactive-video inspector imported eagerly');
    });

    const module = await import('../../../widgets/registry/builtin-widget-plugins');
    const types = module.builtinWidgetPlugins.map((plugin) => plugin.type);

    expect(types).toContain('dynamic-map');
    expect(types).toContain('interactive-video');

    vi.doUnmock('../../../widgets/modules/dynamic-map.renderer');
    vi.doUnmock('../../../widgets/modules/dynamic-map.inspector');
    vi.doUnmock('../../../widgets/modules/interactive-video.renderer');
    vi.doUnmock('../../../widgets/modules/interactive-video.inspector');
  });
});
