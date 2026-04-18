import { createModuleDefinition } from '../module-definition-factory';
import { renderFormStage } from '../form.renderer';

export const FormDefinition = createModuleDefinition({
  type: 'form',
  label: 'Form',
  category: 'interactive',
  frame: { x: 80, y: 50, width: 230, height: 128, rotation: 0 },
  props: {
    title: 'Lead form',
    fieldOne: 'Name',
    fieldTwo: 'Email',
    fieldThree: 'Phone',
    ctaLabel: 'Submit',
    submitTargetType: 'webhook',
    submitUrl: '',
    successMessage: 'Submitted',
    method: 'POST',
    timeoutMs: 4000,
    fallbackMode: 'success',
    consentRequired: true,
    consentLabel: 'I agree to share my data',
  },
  inspectorFields: [
    { key: 'title' },
    { key: 'fieldOne', label: 'Field 1' },
    { key: 'fieldTwo', label: 'Field 2' },
    { key: 'fieldThree', label: 'Field 3' },
    { key: 'ctaLabel', label: 'CTA label' },
    { key: 'submitTargetType', label: 'Submit target' },
    { key: 'submitUrl', label: 'Submit URL' },
    { key: 'successMessage', label: 'Success message' },
    { key: 'consentRequired', label: 'Consent required', type: 'checkbox' },
    { key: 'consentLabel', label: 'Consent label' },
  ],
  style: { backgroundColor: '#ffffff', accentColor: '#ec4899', color: '#111827' },
  renderStage: renderFormStage,
});
