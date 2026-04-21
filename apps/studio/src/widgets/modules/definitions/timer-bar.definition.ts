import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderTimerBarStage } from '../timer-bar.renderer';
import { TimerBarInspector } from '../timer-bar.inspector';

export const TimerBarDefinition = createModuleDefinition({
  type: 'timer-bar',
  label: 'Timer Bar',
  category: 'interactive',
  frame: { x: 20, y: 20, width: 280, height: 12, rotation: 0 },
  props: { durationMs: 7000, orientation: 'horizontal', fillColor: '#00e5ff', trackColor: 'rgba(255,255,255,0.2)', borderRadius: 4, thickness: 8 },
  style: { backgroundColor: 'transparent', accentColor: '#00e5ff', color: '#ffffff' },
  renderStage: renderTimerBarStage,
  renderInspector: (node) => createElement(TimerBarInspector, { node }),
  exportDetail: 'Bocadeli World Cup timer bar',
});
