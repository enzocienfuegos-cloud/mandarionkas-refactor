import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderScratchRevealExport } from '../scratch-reveal.export';
import { renderScratchRevealStage } from '../scratch-reveal.renderer';
import { ScratchRevealInspector } from '../scratch-reveal.inspector';
import { ScratchRevealLibraryPreview, ScratchRevealThumb } from '../../registry/widget-thumbnails';

export const ScratchRevealDefinition = createModuleDefinition({
  type: 'scratch-reveal',
  label: 'Scratch & Reveal',
  category: 'interactive',
  thumbnail: ScratchRevealThumb,
  renderLibraryPreview: ScratchRevealLibraryPreview,
  frame: { x: 80, y: 60, width: 220, height: 116, rotation: 0 },
  props: {
    title: 'Scratch & Reveal',
    coverLabel: 'Scratch to reveal',
    revealLabel: '20% off today',
    beforeImage: '',
    afterImage: '',
    coverBlur: 0,
    scratchRadius: 22,
    autoRevealThresholdPercent: 10,
    revealAnimationPreset: 'none',
    revealAnimationDurationMs: 700,
    revealAnimationDelayMs: 0,
  },
  renderInspector: (widget) => createElement(ScratchRevealInspector, { widget }),
  style: { backgroundColor: '#111827', accentColor: '#f97316', color: '#ffffff' },
  renderStage: renderScratchRevealStage,
  renderExport: (node) => renderScratchRevealExport(node),
});
