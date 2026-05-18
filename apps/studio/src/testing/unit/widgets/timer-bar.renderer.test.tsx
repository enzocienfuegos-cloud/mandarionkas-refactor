import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RenderContext } from '../../../canvas/stage/render-context';
import type { WidgetNode } from '../../../domain/document/types';
import { renderTimerBarStage } from '../../../widgets/modules/timer-bar.renderer';

function createNode(props: Partial<WidgetNode['props']> = {}): WidgetNode {
  return {
    id: 'timer_1',
    type: 'timer-bar',
    name: 'Timer bar',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 300, height: 24, rotation: 0 },
    props: {
      durationSource: 'custom',
      durationMs: 1000,
      orientation: 'horizontal',
      fillColor: '#00d4ff',
      trackColor: 'rgba(255,255,255,0.18)',
      borderRadius: 4,
      thickness: 8,
      ...props,
    },
    style: {},
    timeline: { startMs: 0, endMs: 1000 },
  };
}

function createContext(playheadMs: number): RenderContext {
  return {
    previewMode: false,
    playheadMs,
    sceneDurationMs: 5000,
    hovered: false,
    active: false,
    widgetsById: {},
    triggerWidgetAction: () => undefined,
  };
}

describe('timer bar renderer', () => {
  it('renders horizontal progress with a compositor transform instead of width changes', () => {
    const markup = renderToStaticMarkup(renderTimerBarStage(createNode(), createContext(250)));

    expect(markup).toContain('transform:scale3d(0.75, 1, 1)');
    expect(markup).toContain('transform-origin:left center');
    expect(markup).toContain('will-change:transform');
    expect(markup).not.toContain('width:75%');
  });

  it('renders vertical progress with bottom-origin scaleY behavior', () => {
    const markup = renderToStaticMarkup(renderTimerBarStage(createNode({ orientation: 'vertical' }), createContext(250)));

    expect(markup).toContain('transform:scale3d(1, 0.75, 1)');
    expect(markup).toContain('transform-origin:center bottom');
    expect(markup).not.toContain('height:75%');
  });
});
