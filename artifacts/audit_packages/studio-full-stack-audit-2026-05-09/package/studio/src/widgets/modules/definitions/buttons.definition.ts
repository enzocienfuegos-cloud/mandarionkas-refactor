import { createModuleDefinition } from '../module-definition-factory';
import { BUTTONS_DEFAULT_PROPS } from '../buttons.shared';
import { renderButtonsExport } from '../export-renderers';
import { renderButtonsStage } from '../buttons.renderer';
import { ButtonsThumb } from '../../registry/widget-thumbnails';

export const ButtonsDefinition = createModuleDefinition({
  type: 'buttons',
  label: 'Buttons',
  category: 'interactive',
  thumbnail: ButtonsThumb,
  frame: { x: 80, y: 70, width: 220, height: 96, rotation: 0 },
  props: BUTTONS_DEFAULT_PROPS,
  inspectorFields: [{ key: 'title' }, { key: 'primaryLabel', label: 'Primary label' }, { key: 'secondaryLabel', label: 'Secondary label' }, { key: 'orientation' }],
  style: { backgroundColor: '#0f766e', accentColor: '#67e8f9', color: '#ffffff' },
  renderStage: renderButtonsStage,
  renderExport: (node) => renderButtonsExport(node),
});
