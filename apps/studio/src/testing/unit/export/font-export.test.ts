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

  it('includes advanced typography styles in exported text widget styles', () => {
    const html = renderTextExport({
      id: 'text_2',
      type: 'text',
      name: 'Text',
      sceneId: 'scene_1',
      zIndex: 1,
      frame: { x: 0, y: 0, width: 200, height: 60, rotation: 0 },
      props: { text: 'Hello' },
      style: {
        fontFamily: 'Inter',
        color: '#ffffff',
        fontSize: 28,
        fontWeight: 600,
        fontStyle: 'italic',
        lineHeight: 1.35,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        textDecoration: 'underline',
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any);

    expect(html).toContain('font-style:italic');
    expect(html).toContain('line-height:1.35');
    expect(html).toContain('letter-spacing:0.04em');
    expect(html).toContain('text-transform:uppercase');
    expect(html).toContain('text-decoration:underline');
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
