import { useEffect, useRef, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { submitFormWebhook } from './form-submit-service';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';

function FormModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const scale = Math.max(0.5, Math.min(1.02, Math.min(node.frame.width / 250, node.frame.height / 184)));
  const compactGap = Math.max(4, Math.round(8 * scale));
  const compactPaddingY = Math.max(6, Math.round(8 * scale));
  const compactPaddingX = Math.max(8, Math.round(10 * scale));
  const compactFont = Math.max(10, Math.round(11 * scale));
  const [form, setForm] = useState({ one: '', two: '', three: '' });
  const [consentChecked, setConsentChecked] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const submitTargetType = String(node.props.submitTargetType ?? 'none');
  const submitUrl = String(node.props.submitUrl ?? '');
  const successMessage = String(node.props.successMessage ?? 'Submitted');
  const method = String(node.props.method ?? 'POST').toUpperCase();
  const consentRequired = Boolean(node.props.consentRequired ?? true);
  const consentLabel = String(node.props.consentLabel ?? 'I agree to share my data');
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
    { key: 'one', label: String(node.props.fieldOne ?? 'Name') },
    { key: 'two', label: String(node.props.fieldTwo ?? 'Email') },
    { key: 'three', label: String(node.props.fieldThree ?? 'Phone') },
  ];

  return <div style={{ ...moduleShell(node, ctx), overflow: 'hidden' }}><div style={{ ...moduleHeader(node), padding: `${Math.max(6, Math.round(8 * scale))}px ${compactPaddingX}px 0`, fontSize: Math.max(9, Math.round(11 * scale)) }}>{String(node.props.title ?? node.name)}</div><div style={{ ...moduleBody, padding: `${Math.max(4, Math.round(6 * scale))}px ${compactPaddingX}px ${Math.max(6, Math.round(8 * scale))}px`, gap: compactGap, overflowY: 'auto' }}>{fields.map(({ key, label }) => <input key={key} value={form[key]} onChange={(e) => {
    const nextForm = { ...form, [key]: e.target.value };
    setForm(nextForm);
    setStatus('idle');
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      void sendDraft(nextForm);
    }, 650);
  }} onPointerDown={(e) => e.stopPropagation()} placeholder={label} style={{ borderRadius: 12, padding: `${compactPaddingY}px ${compactPaddingX}px`, background: '#f8fafc', color: '#0f172a', border: '1px solid rgba(15,23,42,.12)', fontSize: compactFont }} />)}{consentRequired ? <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: compactFont, lineHeight: 1.35, color: '#334155' }} onPointerDown={(e) => e.stopPropagation()}><input type="checkbox" checked={consentChecked} onChange={(e) => {
    setConsentChecked(e.target.checked);
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      void sendDraft(form, e.target.checked);
    }, 200);
  }} style={{ margin: 0, width: Math.max(14, Math.round(16 * scale)), height: Math.max(14, Math.round(16 * scale)), accentColor: accent, flex: '0 0 auto' }} /> <span>{consentLabel}</span></label> : null}<button type="button" onClick={onSubmit} style={{ marginTop: 'auto', padding: `${compactPaddingY}px ${compactPaddingX}px`, borderRadius: 12, background: accent, color: '#111827', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: compactFont }}>{status === 'submitting' ? 'Submitting…' : status === 'submitted' ? successMessage : status === 'error' ? (consentRequired && !consentChecked ? 'Accept consent' : 'Retry submit') : String(node.props.ctaLabel ?? 'Submit')}</button></div></div>;
}

export function renderFormStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <FormModuleRenderer node={node} ctx={ctx} />;
}
