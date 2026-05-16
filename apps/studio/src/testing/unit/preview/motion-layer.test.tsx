import { act, create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import { MotionLayer } from '../../../motion/react/MotionLayer';

function createMotionWidget(): WidgetNode {
  return {
    id: 'test',
    type: 'cta',
    name: 'Test CTA',
    sceneId: 'scene-1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 100, height: 40, rotation: 0 },
    props: {},
    style: {},
    timeline: { startMs: 0, endMs: 5000, keyframes: [] },
    motion: { templateId: 'appear', config: { durationMs: 700, delayMs: 0 } },
  } as WidgetNode;
}

describe('MotionLayer DOM structure', () => {
  it('renders an outer wrapper and an inner motion target without inline transform or opacity', () => {
    const widget = createMotionWidget();
    const outerStyle = { transform: 'rotate(15deg)', opacity: 0.8, left: 100, top: 50 };

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <MotionLayer
          widget={widget}
          playheadMs={0}
          previewMode={false}
          isPlaying={false}
          selected
          opacity={1}
          style={outerStyle}
        >
          <span>child</span>
        </MotionLayer>,
      );
    });

    const tree = renderer!.toJSON();
    expect(tree).toBeTruthy();
    if (!tree || Array.isArray(tree)) return;

    expect(tree.props.style).toEqual(expect.objectContaining({ transform: 'rotate(15deg)', left: 100, top: 50 }));
    expect(tree.props.style).not.toHaveProperty('opacity');

    const inner = tree.children?.[0];
    expect(inner).toBeTruthy();
    if (!inner || typeof inner === 'string' || Array.isArray(inner)) return;
    expect(inner.props.style).not.toHaveProperty('transform');
    expect(inner.props.style).not.toHaveProperty('opacity');
  });
});
