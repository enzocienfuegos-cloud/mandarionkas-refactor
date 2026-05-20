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
    // Reveal mode: 'image' | 'layers-below' | 'scene'
    revealMode: 'image',
    revealTargetSceneId: '',
    // Cover
    beforeImage: '',
    beforeAssetId: '',
    coverColor: '#1e293b',
    coverBlur: 0,
    // Reveal (image mode)
    afterImage: '',
    afterAssetId: '',
    revealAnimationPreset: 'none',
    revealAnimationDurationMs: 700,
    revealAnimationDelayMs: 0,
    // Scratch mechanics
    scratchRadius: 22,
    autoRevealThresholdPercent: 60,
    // Labels (image mode)
    title: 'Scratch & Reveal',
    coverLabel: 'Scratch to reveal',
    revealLabel: '',
  },
  renderInspector: (widget) => createElement(ScratchRevealInspector, { widget }),
  style: { backgroundColor: '#111827', accentColor: '#f97316', color: '#ffffff' },
  renderStage: renderScratchRevealStage,
  renderExport: (node) => renderScratchRevealExport(node),
});
