import { createModuleDefinition } from '../module-definition-factory';
import { renderSliderExport } from '../export-renderers';
import { renderSliderStage } from '../slider.renderer';

export const SliderDefinition = createModuleDefinition({
  type: 'slider',
  label: 'Slider',
  category: 'interactive',
  frame: { x: 80, y: 90, width: 230, height: 90, rotation: 0 },
  props: { title: 'Slider', beforeLabel: 'Before', afterLabel: 'After', value: 40 },
  style: { backgroundColor: '#ec4899', accentColor: '#ffffff', color: '#ffffff' },
  renderStage: renderSliderStage,
  renderExport: (node) => renderSliderExport(node),
});
