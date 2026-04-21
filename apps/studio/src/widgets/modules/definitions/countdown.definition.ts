import { createModuleDefinition } from '../module-definition-factory';
import { renderCountdownStage } from '../countdown.renderer';

export const CountdownDefinition = createModuleDefinition({
  type: 'countdown',
  label: 'Countdown',
  category: 'interactive',
  frame: { x: 60, y: 60, width: 240, height: 120, rotation: 0 },
  props: { title: 'Countdown', days: 12, hours: 8, minutes: 45, seconds: 13, format: 'dd:hh:mm:ss' },
  inspectorFields: [{ key: 'title' }, { key: 'days', type: 'number' }, { key: 'hours', type: 'number' }, { key: 'minutes', type: 'number' }, { key: 'seconds', type: 'number' }, { key: 'format' }],
  style: { backgroundColor: '#1f2937', accentColor: '#f59e0b', color: '#ffffff' },
  renderStage: renderCountdownStage,
});
