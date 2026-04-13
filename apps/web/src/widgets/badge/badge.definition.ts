import { createId } from '../../domain/document/factories';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { getBaseWidgetStyle, escapeHtml } from '../registry/export-helpers';
import { renderBadgeWidget } from './badge.renderer';

function renderBadgeExport(node: import('../../domain/document/types').WidgetNode): string {
  const base = `${getBaseWidgetStyle(node)};display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 14px;border-radius:${Number(node.style.borderRadius ?? 999)}px;background:${escapeHtml(String(node.style.backgroundColor ?? '#7c3aed'))};border:1px solid ${escapeHtml(String(node.style.borderColor ?? 'rgba(255,255,255,0.18)'))};box-shadow:${escapeHtml(String(node.style.boxShadow ?? '0 12px 24px rgba(0,0,0,0.18)'))};`;
  const icon = String(node.props.icon ?? '').trim();
  const text = escapeHtml(String(node.props.text ?? 'Badge'));
  return `<div class="widget widget-badge" data-widget-id="${node.id}" style="${base}">${icon ? `<span aria-hidden="true">${escapeHtml(icon)}</span>` : ''}<span>${text}</span></div>`;
}

export const badgeDefinition: WidgetDefinition = {
  type: 'badge',
  label: 'Badge',
  category: 'content',
  defaults: (sceneId, zIndex) => ({
    id: createId('badge'),
    type: 'badge',
    name: 'Badge',
    sceneId,
    zIndex,
    frame: { x: 40, y: 40, width: 180, height: 44, rotation: 0 },
    props: { text: 'New badge', icon: '★' },
    style: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: 800,
      backgroundColor: '#7c3aed',
      borderRadius: 999,
      borderColor: 'rgba(255,255,255,0.18)',
      boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
    },
    timeline: { startMs: 0, endMs: 15000 },
  }),
  inspectorSections: ['position-size', 'timing', 'states', 'data-bindings', 'variants'],
  inspectorTabs: createInspectorTabs([
    { id: 'basics', label: 'Basics', panels: ['position-size', 'widget-fields', 'timing'] },
    { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
    { id: 'data', label: 'Data', panels: ['data-bindings', 'variants'] },
  ]),
  inspectorTitle: 'Badge content',
  inspectorFields: [
    { key: 'text', label: 'Label', type: 'text' },
    { key: 'icon', label: 'Icon', type: 'text' },
  ],
  renderStage: renderBadgeWidget,
  renderExport: (node) => renderBadgeExport(node),
  renderLabel: (node) => String(node.props.text ?? node.name),
};
