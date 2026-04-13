import { createModuleDefinition } from '../module-definition-factory';
import { renderButtonsStage } from '../buttons.renderer';

export const ButtonsDefinition = createModuleDefinition({
  type: 'buttons',
  label: 'Buttons',
  category: 'interactive',
  frame: { x: 80, y: 70, width: 220, height: 96, rotation: 0 },
  props: { title: 'Buttons', primaryLabel: 'Buy now', secondaryLabel: 'Learn more', orientation: 'horizontal' },
  inspectorFields: [{ key: 'title' }, { key: 'primaryLabel', label: 'Primary label' }, { key: 'secondaryLabel', label: 'Secondary label' }, { key: 'orientation' }],
  style: { backgroundColor: '#0f766e', accentColor: '#67e8f9', color: '#ffffff' },
  renderStage: renderButtonsStage,
});
