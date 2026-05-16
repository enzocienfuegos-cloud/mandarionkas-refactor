import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { collectClientPreviewFontFaces } from '../../../features/client-preview/font-faces';

describe('client preview font faces', () => {
  it('collects linked custom fonts from the preview document state', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;

    state.document.widgets.text_1 = {
      id: 'text_1',
      type: 'text',
      name: 'Headline',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 200, height: 60, rotation: 0 },
      props: {
        text: 'Hello',
        fontAssetId: 'font_1',
        fontAssetSrc: 'https://cdn.example.com/headline-sans.woff2',
      },
      style: {
        fontFamily: 'SMX_Headline_Sans_asset-',
        color: '#ffffff',
        fontSize: 28,
        fontWeight: 700,
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('text_1');

    expect(collectClientPreviewFontFaces(state)).toEqual([
      {
        family: 'SMX_Headline_Sans_asset-',
        src: 'https://cdn.example.com/headline-sans.woff2',
      },
    ]);
  });

  it('deduplicates repeated font links across preview widgets', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;

    state.document.widgets.text_1 = {
      id: 'text_1',
      type: 'text',
      name: 'Headline',
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
    state.document.widgets.text_2 = {
      id: 'text_2',
      type: 'text',
      name: 'Subhead',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 80, width: 200, height: 60, rotation: 0 },
      props: {
        text: 'World',
        fontAssetId: 'font_1',
        fontAssetSrc: 'https://cdn.example.com/headline-sans.woff2',
      },
      style: { fontFamily: 'SMX_Headline_Sans_asset-', color: '#ffffff', fontSize: 20, fontWeight: 500 },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('text_1', 'text_2');

    expect(collectClientPreviewFontFaces(state)).toHaveLength(1);
  });
});
