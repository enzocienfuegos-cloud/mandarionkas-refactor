import { useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { submitFormWebhook } from './form-submit-service';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';

function FormModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const [form, setForm] = useState({ one: '', two: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const submitTargetType = String(node.props.submitTargetType ?? 'none');
  const submitUrl = String(node.props.submitUrl ?? '');
  const successMessage = String(node.props.successMessage ?? 'Submitted');
  const method = String(node.props.method ?? 'POST').toUpperCase();

  const onSubmit = async (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
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
        },
        widgetId: node.id,
        widgetName: node.name,
      });
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  };

  return <div style={moduleShell(node, ctx)}><div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div><div style={moduleBody}>{[['one', String(node.props.fieldOne ?? 'Name')], ['two', String(node.props.fieldTwo ?? 'Email')]].map(([key, label]) => <input key={key} value={form[key as 'one'|'two']} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} onPointerDown={(e) => e.stopPropagation()} placeholder={label} style={{ borderRadius: 10, padding: '10px 12px', background: '#f8fafc', color: '#0f172a', border: '1px solid rgba(15,23,42,.12)' }} />)}<div style={{ fontSize: 11, opacity: .7 }}>Target: {submitTargetType}{submitUrl ? ' · webhook ready' : ''}</div><button type="button" onClick={onSubmit} style={{ marginTop: 'auto', padding: '10px 12px', borderRadius: 12, background: accent, color: '#111827', fontWeight: 800, border: 'none', cursor: 'pointer' }}>{status === 'submitting' ? 'Submitting…' : status === 'submitted' ? successMessage : status === 'error' ? 'Retry submit' : String(node.props.ctaLabel ?? 'Submit')}</button></div></div>;
}

export function renderFormStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <FormModuleRenderer node={node} ctx={ctx} />;
}
