import { createModuleDefinition } from '../module-definition-factory';
import { renderScratchRevealStage } from '../scratch-reveal.renderer';

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
  inspectorFields: [
    { key: 'title' },
    { key: 'coverLabel', label: 'Cover label' },
    { key: 'revealLabel', label: 'Reveal label' },
    { key: 'beforeImage', label: 'Cover image URL' },
    { key: 'afterImage', label: 'Reveal image URL' },
    { key: 'coverBlur', label: 'Cover blur', type: 'number' },
    { key: 'scratchRadius', label: 'Scratch radius', type: 'number' },
  ],
  style: { backgroundColor: '#111827', accentColor: '#f97316', color: '#ffffff' },
  renderStage: renderScratchRevealStage,
});
