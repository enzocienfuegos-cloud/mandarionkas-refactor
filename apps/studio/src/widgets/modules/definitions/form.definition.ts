import { createModuleDefinition } from '../module-definition-factory';
import { renderFormExport } from '../form.export';
import { renderFormStage } from '../form.renderer';
import { FORM_DEFAULT_PROPS } from '../form.shared';
import { FormThumb } from '../../registry/widget-thumbnails';

export const FormDefinition = createModuleDefinition({
  type: 'form',
  label: 'Form',
  category: 'interactive',
  thumbnail: FormThumb,
  frame: { x: 80, y: 50, width: 230, height: 128, rotation: 0 },
  props: FORM_DEFAULT_PROPS,
  inspectorFields: [
    { key: 'title' },
    { key: 'fieldOne', label: 'Field 1' },
    { key: 'fieldTwo', label: 'Field 2' },
    { key: 'fieldThree', label: 'Field 3' },
    { key: 'ctaLabel', label: 'CTA label' },
    { key: 'submitTargetType', label: 'Submit target' },
    { key: 'submitUrl', label: 'Submit URL' },
    { key: 'successMessage', label: 'Success message' },
    { key: 'formScale', label: 'Form scale %', type: 'number' },
    { key: 'consentRequired', label: 'Consent required', type: 'checkbox' },
    { key: 'consentLabel', label: 'Consent label' },
  ],
  style: { backgroundColor: '#ffffff', accentColor: '#ec4899', color: '#111827' },
  renderStage: renderFormStage,
  renderExport: (node) => renderFormExport(node),
});
