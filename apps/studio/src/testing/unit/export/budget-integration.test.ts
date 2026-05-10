import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { buildExportPreflight } from '../../../export/engine';

function createHeavyImageDataUri(bytes: number): string {
  return `data:image/png;base64,${'A'.repeat(bytes)}`;
}

function buildImageState(targetChannel: 'mraid' | 'google-display', src: string) {
  const state = createInitialState();
  const sceneId = state.document.scenes[0].id;
  state.document.metadata.release.targetChannel = targetChannel;
  if (targetChannel === 'mraid') {
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
  }
  state.document.widgets.image_1 = {
    id: 'image_1',
    type: 'image',
    name: 'Hero',
    sceneId,
    zIndex: 1,
    frame: { x: 0, y: 0, width: 300, height: 200, rotation: 0 },
    style: {},
    props: { src, alt: 'Hero' },
    timeline: { startMs: 0, endMs: 1_000 },
  } as any;
  state.document.widgets.cta_1 = {
    id: 'cta_1',
    type: 'cta',
    name: 'CTA',
    sceneId,
    zIndex: 2,
    frame: { x: 20, y: 220, width: 160, height: 44, rotation: 0 },
    style: {},
    props: { text: 'Open', url: 'https://example.com' },
    timeline: { startMs: 0, endMs: 1_000 },
  } as any;
  state.document.actions.cta_exit = {
    id: 'cta_exit',
    widgetId: 'cta_1',
    trigger: 'click',
    type: 'open-url',
    url: 'https://example.com',
    label: 'Exit',
  };
  state.document.scenes[0].widgetIds.push('image_1', 'cta_1');
  return state;
}

describe('budget integration', () => {
  it('keeps a light MRAID document within channel budget', () => {
    const preflight = buildExportPreflight(buildImageState('mraid', 'https://cdn.example.com/hero.png'));

    expect(preflight.channelBlockers.some((item) => item.id.startsWith('budget-'))).toBe(false);
  });

  it('blocks oversized MRAID documents with budget errors', () => {
    const preflight = buildExportPreflight(buildImageState('mraid', createHeavyImageDataUri(1_400_000)));

    expect(preflight.channelBlockers.some((item) => item.id.startsWith('budget-'))).toBe(true);
    expect(preflight.channelChecklist.some((item) => item.id === 'budget-zipBytes' && !item.passed && item.severity === 'error')).toBe(true);
  });

  it('downgrades oversized display documents to warnings', () => {
    const preflight = buildExportPreflight(buildImageState('google-display', createHeavyImageDataUri(1_400_000)));

    expect(preflight.channelBlockers.some((item) => item.id.startsWith('budget-'))).toBe(false);
    expect(preflight.channelWarnings.some((item) => item.id.startsWith('budget-'))).toBe(true);
  });
});
