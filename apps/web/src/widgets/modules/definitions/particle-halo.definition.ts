import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderParticleHaloStage } from '../particle-halo.renderer';
import { ParticleHaloInspector } from '../particle-halo.inspector';

export const ParticleHaloDefinition = createModuleDefinition({
  type: 'particle-halo',
  label: 'Particle Halo',
  category: 'interactive',
  frame: { x: 50, y: 50, width: 160, height: 160, rotation: 0 },
  props: { size: 160, radius: 64, count: 12, colorA: '#ffffff', colorB: '#00c9ff', pulseMs: 1800 },
  style: { backgroundColor: 'transparent', accentColor: '#00c9ff', color: '#ffffff' },
  renderStage: renderParticleHaloStage,
  renderInspector: (node) => createElement(ParticleHaloInspector, { node }),
  exportDetail: 'Bocadeli World Cup particle halo',
});
