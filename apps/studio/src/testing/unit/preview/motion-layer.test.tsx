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
  it('renders an outer wrapper and an inner motion target without inline transform or opacity on the outer node', () => {
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
          selected={false}
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
    expect(inner.props.style).toEqual(expect.objectContaining({ opacity: 1 }));
  });

  it('renders the resting end-state for non-selected entrance motion in edit mode', () => {
    const widget = createMotionWidget();

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <MotionLayer
          widget={widget}
          playheadMs={0}
          previewMode={false}
          isPlaying={false}
          selected={false}
          opacity={1}
        >
          <span>child</span>
        </MotionLayer>,
      );
    });

    const tree = renderer!.toJSON();
    expect(tree).toBeTruthy();
    if (!tree || Array.isArray(tree)) return;
    const inner = tree.children?.[0];
    expect(inner).toBeTruthy();
    if (!inner || typeof inner === 'string' || Array.isArray(inner)) return;
    expect(inner.props.style).toEqual(expect.objectContaining({ opacity: 1 }));
  });

  it('derives preview motion state from the playhead during scene playback', () => {
    const widget = createMotionWidget();

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <MotionLayer
          widget={widget}
          playheadMs={0}
          previewMode
          isPlaying
          selected={false}
          opacity={1}
        >
          <span>child</span>
        </MotionLayer>,
      );
    });

    let tree = renderer!.toJSON();
    expect(tree).toBeTruthy();
    if (!tree || Array.isArray(tree)) return;
    let inner = tree.children?.[0];
    expect(inner).toBeTruthy();
    if (!inner || typeof inner === 'string' || Array.isArray(inner)) return;
    expect(inner.props.style).toEqual(expect.objectContaining({ opacity: 0 }));

    act(() => {
      renderer!.update(
        <MotionLayer
          widget={widget}
          playheadMs={700}
          previewMode
          isPlaying
          selected={false}
          opacity={1}
        >
          <span>child</span>
        </MotionLayer>,
      );
    });

    tree = renderer!.toJSON();
    expect(tree).toBeTruthy();
    if (!tree || Array.isArray(tree)) return;
    inner = tree.children?.[0];
    expect(inner).toBeTruthy();
    if (!inner || typeof inner === 'string' || Array.isArray(inner)) return;
    expect(inner.props.style).toEqual(expect.objectContaining({ opacity: 1 }));
  });
});
