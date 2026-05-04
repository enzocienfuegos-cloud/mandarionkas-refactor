import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderScratchRevealExport } from '../export-renderers';
import { renderScratchRevealStage } from '../scratch-reveal.renderer';
import { ScratchRevealInspector } from '../scratch-reveal.inspector';

export const ScratchRevealDefinition = createModuleDefinition({
  type: 'scratch-reveal',
  label: 'Scratch & Reveal',
  category: 'interactive',
  frame: { x: 80, y: 60, width: 220, height: 116, rotation: 0 },
  props: {
    title: 'Scratch & Reveal',
    coverLabel: 'Scratch to reveal',
    revealLabel: '20% off today',
    beforeImage: '',
    afterImage: '',
    coverBlur: 6,
    scratchRadius: 22,
  },
  renderInspector: (widget) => createElement(ScratchRevealInspector, { widget }),
  style: { backgroundColor: '#111827', accentColor: '#f97316', color: '#ffffff' },
  renderStage: renderScratchRevealStage,
  renderExport: (node) => renderScratchRevealExport(node),
});
