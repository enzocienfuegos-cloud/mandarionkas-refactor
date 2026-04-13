import { createModuleDefinition } from '../module-definition-factory';
import { renderSpeedTestStage } from '../speed-test.renderer';

export const SpeedTestDefinition = createModuleDefinition({
  type: 'speed-test',
  label: 'Speed Test',
  category: 'interactive',
  frame: { x: 80, y: 60, width: 220, height: 116, rotation: 0 },
  props: { title: 'Speed Test', min: 10, max: 100, current: 64, units: 'Mbps' },
  style: { backgroundColor: '#0b3b7a', accentColor: '#2dd4bf', color: '#ffffff' },
  renderStage: renderSpeedTestStage,
});
