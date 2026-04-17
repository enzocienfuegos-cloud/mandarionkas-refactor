import { createModuleDefinition } from '../module-definition-factory';
import { renderScratchRevealStage } from '../scratch-reveal.renderer';

export const ScratchRevealDefinition = createModuleDefinition({
  type: 'scratch-reveal',
  label: 'Scratch & Reveal',
  category: 'interactive',
  frame: { x: 80, y: 60, width: 220, height: 116, rotation: 0 },
  props: { title: 'Scratch & Reveal', beforeLabel: 'Before', afterLabel: 'After', revealAmount: 55 },
  style: { backgroundColor: '#111827', accentColor: '#f97316', color: '#ffffff' },
  renderStage: renderScratchRevealStage,
});
