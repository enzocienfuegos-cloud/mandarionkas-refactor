import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import type { WidgetType } from '../../../domain/document/types';
import type { PortableExportWidget } from '../../../export/portable';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';
import {
  builtinExportRendererPlugins,
  clearExportRendererOverrides,
  hasExportRenderer,
  registerExportRenderer,
  renderLegacyWidgetExport,
  renderWidgetExport,
  type ExportRenderContext,
} from '../../../widgets/modules/export-registry';

function createPortableWidget(type: WidgetType): PortableExportWidget {
  const state = createInitialState();
  const sceneId = state.document.scenes[0].id;
  const widget = getWidgetDefinition(type).defaults(sceneId, 1);
  return {
    ...widget,
    hidden: false,
    locked: false,
    interactions: [],
    assetRefs: [],
  };
}

function createContext(type: WidgetType, patch?: Partial<PortableExportWidget>): ExportRenderContext {
  const state = createInitialState();
  return {
    node: {
      ...createPortableWidget(type),
      ...patch,
      frame: {
        ...createPortableWidget(type).frame,
        ...(patch?.frame ?? {}),
      },
      props: {
        ...createPortableWidget(type).props,
        ...(patch?.props ?? {}),
      },
      style: {
        ...createPortableWidget(type).style,
        ...(patch?.style ?? {}),
      },
    },
    state,
    assetPathMap: {
      'hero.jpg': '/exports/hero.jpg',
      'card.png': '/exports/card.png',
    },
    channel: state.document.metadata.release.targetChannel,
  };
}

afterEach(() => {
  clearExportRendererOverrides();
});

describe('export registry', () => {
  it('discovers unique built-in exporters with source metadata', () => {
    const types = builtinExportRendererPlugins.map((plugin) => plugin.type);

    expect(types).toEqual(expect.arrayContaining(['badge', 'cta', 'dynamic-map', 'image', 'qr-code', 'text']));
    expect(new Set(types).size).toBe(types.length);
    expect(builtinExportRendererPlugins.every((plugin) => plugin.source.endsWith('.export.ts'))).toBe(true);
  });

  it('renders migrated widgets through the registry without changing output', () => {
    const context = createContext('text', {
      props: { text: 'Registry headline' },
      style: { color: '#ffffff', fontSize: 24 },
    });

    expect(hasExportRenderer('text')).toBe(true);
    expect(renderWidgetExport(context)).toBe(renderLegacyWidgetExport(context));
    expect(renderWidgetExport(context)).toContain('Registry headline');
  });

  it('renders dynamic map widgets through the registry with search-bar markup intact', () => {
    const context = createContext('dynamic-map', {
      props: {
        renderMode: 'search-bar',
        requestUserLocation: true,
        infoLabelText: 'Busca una tienda',
        locateMeLabel: 'Ubicame',
        directionsCtaLabel: 'Como llegar',
        nearbyTitleText: 'Mas cercanas',
        markersCsv: 'name,flag,lat,lng,address,badge,openNow,ctaLabel,ctaType,ctaUrl\nSan Salvador,SV,13.6929,-89.2182,Centro Comercial,Open now,true,Open in Maps,maps,',
      },
    });

    expect(hasExportRenderer('dynamic-map')).toBe(true);
    expect(renderWidgetExport(context)).toBe(renderLegacyWidgetExport(context));
    expect(renderWidgetExport(context)).toContain('widget-dynamic-map-search');
    expect(renderWidgetExport(context)).toContain('data-smx-action="map-request-location"');
    expect(renderWidgetExport(context)).toContain('Busca una tienda');
  });

  it('falls back to legacy widget definitions for unmigrated widgets', () => {
    const context = createContext('hero-image', {
      props: { src: 'hero.jpg', alt: 'Hero frame' },
      style: { backgroundColor: '#223142' },
    });

    expect(hasExportRenderer('hero-image')).toBe(false);
    expect(renderWidgetExport(context)).toBe(renderLegacyWidgetExport(context));
    expect(renderWidgetExport(context)).toContain('/exports/hero.jpg');
  });

  it('prefers explicit overrides over discovered exporters', () => {
    const context = createContext('text', {
      props: { text: 'Original text' },
    });

    registerExportRenderer('text', () => '<div data-test-export="override">Override</div>');

    expect(renderWidgetExport(context)).toBe('<div data-test-export="override">Override</div>');
  });
});
