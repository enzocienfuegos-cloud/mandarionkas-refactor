import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import { renderScratchRevealExport } from '../../../widgets/modules/scratch-reveal.export';

function createScratchRevealWidget(props: Partial<WidgetNode['props']> = {}): WidgetNode {
  return {
    id: 'scratch_1',
    type: 'scratch-reveal',
    name: 'Scratch & Reveal',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 220, height: 116, rotation: 0 },
    style: {
      accentColor: '#f97316',
      color: '#ffffff',
      backgroundColor: '#111827',
      borderRadius: 18,
    },
    props: {
      title: 'Scratch & Reveal',
      coverLabel: 'Scratch to reveal',
      revealLabel: '20% off today',
      beforeImage: 'https://cdn.example.com/cover.png',
      afterImage: 'https://cdn.example.com/reveal.png',
      scratchRadius: 24,
      ...props,
    },
    timeline: { startMs: 0, endMs: 1000 },
  };
}

describe('scratch reveal export', () => {
  it('renders the scratch surface full-bleed across the widget', () => {
    const html = renderScratchRevealExport(createScratchRevealWidget());

    expect(html).toContain('class="scratch-reveal-shell"');
    expect(html).toContain('data-scratch');
    expect(html).not.toContain('data-scratch-shell');
    expect(html).toContain('data-scratch-reveal');
    expect(html).toContain('data-scratch-cover');
    expect(html).toContain('data-scratch-cover-blur="0"');
    expect(html).toContain('data-scratch-auto-reveal-threshold="10"');
    expect(html).toContain('style="position:absolute;inset:0;border-radius:inherit;overflow:hidden;');
    expect(html).toContain('data-scratch-canvas style="position:absolute;inset:0;width:100%;height:100%;');
  });

  it('preserves explicit cover blur values when configured', () => {
    const html = renderScratchRevealExport(createScratchRevealWidget({ coverBlur: 9 }));

    expect(html).toContain('data-scratch-cover-blur="9"');
  });

  it('preserves explicit auto reveal threshold values when configured', () => {
    const html = renderScratchRevealExport(createScratchRevealWidget({ autoRevealThresholdPercent: 25 }));

    expect(html).toContain('data-scratch-auto-reveal-threshold="25"');
  });

  it('exports reveal animation metadata for the inner reveal image', () => {
    const html = renderScratchRevealExport(createScratchRevealWidget({ revealAnimationPreset: 'fade-up', revealAnimationDurationMs: 900, revealAnimationDelayMs: 250 }));

    expect(html).toContain('data-scratch-reveal-animation="fade-up"');
    expect(html).toContain('data-scratch-reveal-animation-duration="900"');
    expect(html).toContain('data-scratch-reveal-animation-delay="250"');
    expect(html).toContain('data-scratch-reveal-media');
  });
});
