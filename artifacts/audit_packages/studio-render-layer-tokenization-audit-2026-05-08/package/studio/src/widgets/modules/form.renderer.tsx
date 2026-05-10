import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { submitFormWebhook } from './form-submit-service';
import {
  FORM_DEFAULT_CONSENT_LABEL,
  FORM_DEFAULT_CTA_LABEL,
  FORM_DEFAULT_FIELD_ONE_LABEL,
  FORM_DEFAULT_FIELD_THREE_LABEL,
  FORM_DEFAULT_FIELD_TWO_LABEL,
  FORM_DEFAULT_METHOD,
  FORM_DEFAULT_SCALE,
  FORM_DEFAULT_SUBMIT_TARGET_TYPE,
  FORM_DEFAULT_SUCCESS_MESSAGE,
  FORM_STATUS_LABELS,
} from './form.shared';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';

const formShellOverflowStyle: CSSProperties = {
  overflow: 'hidden',
};

const formFieldBaseStyle: CSSProperties = {
  borderRadius: 12,
  background: '#f8fafc',
  color: '#0f172a',
  border: '1px solid rgba(15,23,42,.12)',
};

const formConsentLabelBaseStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  lineHeight: 1.35,
  color: '#334155',
};

const formSubmitButtonBaseStyle: CSSProperties = {
  marginTop: 'auto',
  borderRadius: 12,
  color: '#111827',
  fontWeight: 800,
  border: 'none',
  cursor: 'pointer',
};

function buildFormShellStyle(node: WidgetNode, ctx: RenderContext): CSSProperties {
  return {
    ...moduleShell(node, ctx),
    ...formShellOverflowStyle,
  };
}

function buildFormHeaderStyle(node: WidgetNode, scale: number, compactPaddingX: number): CSSProperties {
  return {
    ...moduleHeader(node),
    padding: `${Math.max(6, Math.round(8 * scale))}px ${compactPaddingX}px 0`,
    fontSize: Math.max(9, Math.round(11 * scale)),
  };
}

function buildFormBodyStyle(scale: number, compactPaddingX: number, compactGap: number): CSSProperties {
  return {
    ...moduleBody,
    padding: `${Math.max(4, Math.round(6 * scale))}px ${compactPaddingX}px ${Math.max(6, Math.round(8 * scale))}px`,
    gap: compactGap,
    overflowY: 'auto',
  };
}

function buildFormFieldStyle(compactPaddingY: number, compactPaddingX: number, compactFont: number): CSSProperties {
  return {
    ...formFieldBaseStyle,
    padding: `${compactPaddingY}px ${compactPaddingX}px`,
    fontSize: compactFont,
  };
}

function buildFormConsentLabelStyle(compactFont: number): CSSProperties {
  return {
    ...formConsentLabelBaseStyle,
    fontSize: compactFont,
  };
}

function buildFormConsentCheckboxStyle(scale: number, accent: string): CSSProperties {
  const size = Math.max(14, Math.round(16 * scale));
  return {
    margin: 0,
    width: size,
    height: size,
    accentColor: accent,
    flex: '0 0 auto',
  };
}

function buildFormSubmitButtonStyle(
  compactPaddingY: number,
  compactPaddingX: number,
  compactFont: number,
  accent: string,
): CSSProperties {
  return {
    ...formSubmitButtonBaseStyle,
    padding: `${compactPaddingY}px ${compactPaddingX}px`,
    background: accent,
    fontSize: compactFont,
  };
}

function FormModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const userScale = Math.max(45, Math.min(140, Number(node.props.formScale ?? FORM_DEFAULT_SCALE))) / 100;
  const scale = Math.max(0.38, Math.min(1.1, Math.min(node.frame.width / 250, node.frame.height / 184) * userScale));
  const compactGap = Math.max(4, Math.round(8 * scale));
  const compactPaddingY = Math.max(6, Math.round(8 * scale));
  const compactPaddingX = Math.max(8, Math.round(10 * scale));
  const compactFont = Math.max(10, Math.round(11 * scale));
  const [form, setForm] = useState({ one: '', two: '', three: '' });
  const [consentChecked, setConsentChecked] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const submitTargetType = String(node.props.submitTargetType ?? FORM_DEFAULT_SUBMIT_TARGET_TYPE);
  const submitUrl = String(node.props.submitUrl ?? '');
  const successMessage = String(node.props.successMessage ?? FORM_DEFAULT_SUCCESS_MESSAGE);
  const method = String(node.props.method ?? FORM_DEFAULT_METHOD).toUpperCase();
  const consentRequired = Boolean(node.props.consentRequired ?? true);
  const consentLabel = String(node.props.consentLabel ?? FORM_DEFAULT_CONSENT_LABEL);
  const autosaveTimerRef = useRef<number | null>(null);

  const sendDraft = async (nextForm: typeof form, nextConsent = consentChecked) => {
    if (!ctx.previewMode || submitTargetType !== 'webhook' || !submitUrl.trim()) return;
    try {
      await submitFormWebhook({
        url: submitUrl,
        method,
        fields: {
          [String(node.props.fieldOne ?? 'fieldOne')]: nextForm.one,
          [String(node.props.fieldTwo ?? 'fieldTwo')]: nextForm.two,
          [String(node.props.fieldThree ?? 'fieldThree')]: nextForm.three,
          consent: consentRequired ? String(nextConsent) : 'not-required',
        },
        widgetId: node.id,
        widgetName: node.name,
      });
      if (nextForm.one || nextForm.two || nextForm.three) setStatus('submitted');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => () => {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
  }, []);

  const onSubmit = async (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (consentRequired && !consentChecked) {
      setStatus('error');
      return;
    }
    ctx.triggerWidgetAction('click');
    if (!ctx.previewMode || submitTargetType !== 'webhook' || !submitUrl.trim()) {
      setStatus('submitted');
      return;
    }
    try {
      setStatus('submitting');
      await submitFormWebhook({
        url: submitUrl,
        method,
        fields: {
          [String(node.props.fieldOne ?? 'fieldOne')]: form.one,
          [String(node.props.fieldTwo ?? 'fieldTwo')]: form.two,
          [String(node.props.fieldThree ?? 'fieldThree')]: form.three,
          consent: consentRequired ? String(consentChecked) : 'not-required',
        },
        widgetId: node.id,
        widgetName: node.name,
      });
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  };

  const fields: Array<{ key: 'one' | 'two' | 'three'; label: string }> = [
    { key: 'one', label: String(node.props.fieldOne ?? FORM_DEFAULT_FIELD_ONE_LABEL) },
    { key: 'two', label: String(node.props.fieldTwo ?? FORM_DEFAULT_FIELD_TWO_LABEL) },
    { key: 'three', label: String(node.props.fieldThree ?? FORM_DEFAULT_FIELD_THREE_LABEL) },
  ];

  return (
    <div style={buildFormShellStyle(node, ctx)}>
      <div style={buildFormHeaderStyle(node, scale, compactPaddingX)}>{String(node.props.title ?? node.name)}</div>
      <div style={buildFormBodyStyle(scale, compactPaddingX, compactGap)}>
        {fields.map(({ key, label }) => (
          <input
            key={key}
            value={form[key]}
            onChange={(e) => {
              const nextForm = { ...form, [key]: e.target.value };
              setForm(nextForm);
              setStatus('idle');
              if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
              autosaveTimerRef.current = window.setTimeout(() => {
                void sendDraft(nextForm);
              }, 650);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder={label}
            style={buildFormFieldStyle(compactPaddingY, compactPaddingX, compactFont)}
          />
        ))}

        {consentRequired ? (
          <label style={buildFormConsentLabelStyle(compactFont)} onPointerDown={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => {
                setConsentChecked(e.target.checked);
                if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = window.setTimeout(() => {
                  void sendDraft(form, e.target.checked);
                }, 200);
              }}
              style={buildFormConsentCheckboxStyle(scale, accent)}
            />
            <span>{consentLabel}</span>
          </label>
        ) : null}

        <button type="button" onClick={onSubmit} style={buildFormSubmitButtonStyle(compactPaddingY, compactPaddingX, compactFont, accent)}>
          {status === 'submitting'
            ? FORM_STATUS_LABELS.submitting
            : status === 'submitted'
              ? successMessage
              : status === 'error'
                ? (consentRequired && !consentChecked ? FORM_STATUS_LABELS.acceptConsent : FORM_STATUS_LABELS.retrySubmit)
                : String(node.props.ctaLabel ?? FORM_DEFAULT_CTA_LABEL)}
        </button>
      </div>
    </div>
  );
}

export function renderFormStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <FormModuleRenderer node={node} ctx={ctx} />;
}
