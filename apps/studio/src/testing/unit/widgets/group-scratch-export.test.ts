import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import { renderGroupExport } from '../../../widgets/group/group.export';

function createGroupWidget(props: Partial<WidgetNode['props']> = {}): WidgetNode {
  return {
    id: 'group_1',
    type: 'group',
    name: 'Scratch group',
    sceneId: 'scene_1',
    zIndex: 3,
    frame: { x: 0, y: 0, width: 220, height: 160, rotation: 0 },
    style: {
      accentColor: '#8b5cf6',
      color: '#ffffff',
      borderRadius: 18,
      opacity: 1,
    },
    props: {
      title: 'Scratch group',
      scratchEnabled: true,
      coverLabel: 'Scratch to reveal',
      beforeImage: 'https://cdn.example.com/cover.png',
      scratchRadius: 24,
      autoRevealThresholdPercent: 10,
      ...props,
    },
    timeline: { startMs: 0, endMs: 1000 },
    childIds: ['text_1', 'cta_1'],
  };
}

describe('group scratch export', () => {
  it('renders a scratch shell when the group is scratch-enabled', () => {
    const html = renderGroupExport(createGroupWidget());

    expect(html).toContain('widget-group-scratch');
    expect(html).toContain('class="scratch-reveal-shell"');
    expect(html).toContain('data-scratch-cover-image="https://cdn.example.com/cover.png"');
    expect(html).toContain('data-scratch-auto-reveal-threshold="10"');
    expect(html).toContain('data-scratch-canvas');
  });

  it('falls back to the regular group export when scratch is disabled', () => {
    const html = renderGroupExport(createGroupWidget({ scratchEnabled: false }));

    expect(html).not.toContain('class="scratch-reveal-shell"');
    expect(html).toContain('>Group<');
  });
});
