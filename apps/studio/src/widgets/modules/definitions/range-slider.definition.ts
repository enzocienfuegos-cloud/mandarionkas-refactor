import { createModuleDefinition } from '../module-definition-factory';
import { renderRangeSliderExport } from '../export-renderers';
import { renderRangeSliderStage } from '../range-slider.renderer';

export const RangeSliderDefinition = createModuleDefinition({
  type: 'range-slider',
  label: 'Range Slider',
  category: 'interactive',
  frame: { x: 80, y: 100, width: 220, height: 84, rotation: 0 },
  props: { title: 'Range Slider', min: 0, max: 100, value: 65, units: '%' },
  style: { backgroundColor: '#111827', accentColor: '#22c55e', color: '#ffffff' },
  renderStage: renderRangeSliderStage,
  renderExport: (node) => renderRangeSliderExport(node),
});
