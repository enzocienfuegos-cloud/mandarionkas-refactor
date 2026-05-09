import type { WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';
import {
  FORM_DEFAULT_CONSENT_LABEL,
  FORM_DEFAULT_CTA_LABEL,
  FORM_DEFAULT_FIELD_ONE_LABEL,
  FORM_DEFAULT_FIELD_THREE_LABEL,
  FORM_DEFAULT_FIELD_TWO_LABEL,
  FORM_DEFAULT_METHOD,
  FORM_DEFAULT_SUCCESS_MESSAGE,
} from './form.shared';

export function renderFormExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.pink);
  const consentRequired = Boolean(node.props.consentRequired ?? true);
  const consentLabel = String(node.props.consentLabel ?? FORM_DEFAULT_CONSENT_LABEL);
  const fieldThree = String(node.props.fieldThree ?? FORM_DEFAULT_FIELD_THREE_LABEL);
  const userScale = Math.max(45, Math.min(140, Number(node.props.formScale ?? 100))) / 100;
  const scale = Math.max(0.38, Math.min(1.1, Math.min(frame.width / 250, frame.height / 184) * userScale));
  const headerPaddingTop = Math.max(6, Math.round(8 * scale));
  const headerPaddingX = Math.max(8, Math.round(10 * scale));
  const bodyPaddingTop = Math.max(4, Math.round(6 * scale));
  const bodyPaddingBottom = Math.max(6, Math.round(8 * scale));
  const inputPaddingY = Math.max(6, Math.round(8 * scale));
  const inputPaddingX = Math.max(8, Math.round(10 * scale));
  const compactFont = Math.max(10, Math.round(11 * scale));
  const checkboxSize = Math.max(14, Math.round(16 * scale));
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.white)}`,`color:${String(style.color ?? exportPalette.ink)}`,`display:flex`,`flex-direction:column`,
  ].join(';');

  return `<form class="widget widget-form" data-widget-id="${node.id}" data-form-target-type="${escapeHtml(String(node.props.submitTargetType ?? 'none'))}" data-form-submit-url="${escapeHtml(String(node.props.submitUrl ?? ''))}" data-form-method="${escapeHtml(String(node.props.method ?? FORM_DEFAULT_METHOD).toUpperCase())}" data-form-success-message="${escapeHtml(String(node.props.successMessage ?? FORM_DEFAULT_SUCCESS_MESSAGE))}" data-form-field-one="${escapeHtml(String(node.props.fieldOne ?? FORM_DEFAULT_FIELD_ONE_LABEL))}" data-form-field-two="${escapeHtml(String(node.props.fieldTwo ?? FORM_DEFAULT_FIELD_TWO_LABEL))}" data-form-field-three="${escapeHtml(fieldThree)}" data-form-consent-required="${String(consentRequired)}" style="${base}">
    <div style="padding:${headerPaddingTop}px ${headerPaddingX}px 0;font-size:${Math.max(10, Math.round(12 * scale))}px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:${bodyPaddingTop}px ${headerPaddingX}px ${bodyPaddingBottom}px;display:flex;flex:1;flex-direction:column;gap:${Math.max(4, Math.round(6 * scale))}px;overflow-y:auto;">
      <input data-form-input="one" placeholder="${escapeHtml(String(node.props.fieldOne ?? FORM_DEFAULT_FIELD_ONE_LABEL))}" style="border-radius:10px;padding:${inputPaddingY}px ${inputPaddingX}px;background:${exportPalette.slate50};color:${exportPalette.slate};border:1px solid ${exportPalette.darkInputBorder};font-size:${compactFont}px;" />
      <input data-form-input="two" placeholder="${escapeHtml(String(node.props.fieldTwo ?? FORM_DEFAULT_FIELD_TWO_LABEL))}" style="border-radius:10px;padding:${inputPaddingY}px ${inputPaddingX}px;background:${exportPalette.slate50};color:${exportPalette.slate};border:1px solid ${exportPalette.darkInputBorder};font-size:${compactFont}px;" />
      <input data-form-input="three" placeholder="${escapeHtml(fieldThree)}" style="border-radius:10px;padding:${inputPaddingY}px ${inputPaddingX}px;background:${exportPalette.slate50};color:${exportPalette.slate};border:1px solid ${exportPalette.darkInputBorder};font-size:${compactFont}px;" />
      ${consentRequired ? `<label style="display:flex;gap:10px;align-items:center;font-size:${compactFont}px;line-height:1.35;color:${exportPalette.mutedTextStrong};"><input type="checkbox" data-form-consent style="margin:0;width:${checkboxSize}px;height:${checkboxSize}px;accent-color:${escapeHtml(accent)};flex:0 0 auto;" /><span>${escapeHtml(consentLabel)}</span></label>` : ''}
      <div data-form-status style="font-size:11px;opacity:.7;"></div>
      <button type="submit" style="margin-top:auto;padding:${inputPaddingY}px ${inputPaddingX}px;border-radius:12px;background:${escapeHtml(accent)};color:${exportPalette.ink};font-weight:800;border:none;cursor:pointer;font-size:${compactFont}px;">${escapeHtml(String(node.props.ctaLabel ?? FORM_DEFAULT_CTA_LABEL))}</button>
    </div>
  </form>`;
}

export const formExportRenderer: ExportRendererManifestEntry = {
  type: 'form',
  render: ({ node }) => renderFormExport(node as unknown as WidgetNode),
};
