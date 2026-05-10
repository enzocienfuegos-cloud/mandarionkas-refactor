export const FORM_DEFAULT_TITLE = 'Lead form';
export const FORM_DEFAULT_FIELD_ONE_LABEL = 'Name';
export const FORM_DEFAULT_FIELD_TWO_LABEL = 'Email';
export const FORM_DEFAULT_FIELD_THREE_LABEL = 'Phone';
export const FORM_DEFAULT_CTA_LABEL = 'Submit';
export const FORM_DEFAULT_SUBMIT_TARGET_TYPE = 'webhook';
export const FORM_DEFAULT_SUCCESS_MESSAGE = 'Submitted';
export const FORM_DEFAULT_METHOD = 'POST';
export const FORM_DEFAULT_TIMEOUT_MS = 4000;
export const FORM_DEFAULT_FALLBACK_MODE = 'success';
export const FORM_DEFAULT_CONSENT_REQUIRED = true;
export const FORM_DEFAULT_CONSENT_LABEL = 'I agree to share my data';
export const FORM_DEFAULT_SCALE = 100;

export const FORM_STATUS_LABELS = {
  submitting: 'Submitting…',
  acceptConsent: 'Accept consent',
  retrySubmit: 'Retry submit',
} as const;

export const FORM_DEFAULT_PROPS = {
  title: FORM_DEFAULT_TITLE,
  fieldOne: FORM_DEFAULT_FIELD_ONE_LABEL,
  fieldTwo: FORM_DEFAULT_FIELD_TWO_LABEL,
  fieldThree: FORM_DEFAULT_FIELD_THREE_LABEL,
  ctaLabel: FORM_DEFAULT_CTA_LABEL,
  submitTargetType: FORM_DEFAULT_SUBMIT_TARGET_TYPE,
  submitUrl: '',
  successMessage: FORM_DEFAULT_SUCCESS_MESSAGE,
  method: FORM_DEFAULT_METHOD,
  timeoutMs: FORM_DEFAULT_TIMEOUT_MS,
  fallbackMode: FORM_DEFAULT_FALLBACK_MODE,
  consentRequired: FORM_DEFAULT_CONSENT_REQUIRED,
  consentLabel: FORM_DEFAULT_CONSENT_LABEL,
  formScale: FORM_DEFAULT_SCALE,
} as const;
