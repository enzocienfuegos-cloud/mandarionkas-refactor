import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { buildPortableProjectExport } from '../../../export/portable';
import { renderTextExport } from '../../../widgets/registry/base-exporters';

describe('font export support', () => {
  it('includes font-family in exported text widget styles', () => {
    const html = renderTextExport({
      id: 'text_1',
      type: 'text',
      name: 'Text',
      sceneId: 'scene_1',
      zIndex: 1,
      frame: { x: 0, y: 0, width: 200, height: 60, rotation: 0 },
      props: { text: 'Hello' },
      style: { fontFamily: 'SMX_Headline_Sans_asset-', color: '#ffffff', fontSize: 28, fontWeight: 700 },
      timeline: { startMs: 0, endMs: 1000 },
    } as any);

    expect(html).toContain('font-family:SMX_Headline_Sans_asset-');
  });

  it('packages linked font assets into the portable export asset graph', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.text_1 = {
      id: 'text_1',
      type: 'text',
      name: 'Text',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 200, height: 60, rotation: 0 },
      props: {
        text: 'Hello',
        fontAssetId: 'font_1',
        fontAssetSrc: 'https://cdn.example.com/headline-sans.woff2',
      },
      style: { fontFamily: 'SMX_Headline_Sans_asset-', color: '#ffffff', fontSize: 28, fontWeight: 700 },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('text_1');

    const portable = buildPortableProjectExport(state);

    expect(portable.assets.some((asset) => asset.kind === 'font' && asset.src === 'https://cdn.example.com/headline-sans.woff2')).toBe(true);
  });
});
