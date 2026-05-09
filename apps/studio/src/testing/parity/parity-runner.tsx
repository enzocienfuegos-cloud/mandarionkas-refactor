import React from 'react';
import { create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { createInitialUiState } from '../../domain/document/factories';
import type { ActionNode, StudioDocument, StudioState, WidgetNode } from '../../domain/document/types';
import { buildPortableProjectExport } from '../../export/portable';
import { renderWidgetExport } from '../../widgets/modules/export-registry';
import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import { domDiff } from './dom-diff';
import { normalizeHtml } from './normalize-html';

export type ParityFixture = {
  name: string;
  document: StudioDocument;
  widgetId: string;
  assetPathMap?: Record<string, string>;
};

export type ParitySpec = {
  moduleType: string;
  fixtures: ParityFixture[];
};

const UNITLESS_CSS_PROPERTIES = new Set([
  'fontWeight',
  'lineHeight',
  'opacity',
  'zIndex',
  'order',
  'flex',
  'flexGrow',
  'flexShrink',
  'zoom',
]);

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializeStyleValue(key: string, value: unknown): string {
  if (typeof value === 'number' && value !== 0 && !UNITLESS_CSS_PROPERTIES.has(key)) {
    return `${value}px`;
  }
  return String(value);
}

function serializeStyle(style: Record<string, unknown>): string {
  return Object.entries(style)
    .filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== '')
    .map(([key, value]) => `${toKebabCase(key)}:${serializeStyleValue(key, value)}`)
    .join(';');
}

function serializeProp(key: string, value: unknown): string | null {
  if (key === 'children' || value === undefined || value === null || typeof value === 'function') return null;
  if (key === 'className') return `class="${escapeHtml(value)}"`;
  if (key === 'style' && typeof value === 'object' && value) return `style="${escapeHtml(serializeStyle(value as Record<string, unknown>))}"`;
  if (typeof value === 'boolean') return value ? key : null;
  return `${key}="${escapeHtml(value)}"`;
}

function serializeStageNode(node: ReturnType<ReturnType<typeof create>['toJSON']>): string {
  if (node === null) return '';
  if (typeof node === 'string') return escapeHtml(node);
  if (Array.isArray(node)) return node.map((child) => serializeStageNode(child)).join('');

  const attrs = Object.entries(node.props ?? {})
    .map(([key, value]) => serializeProp(key, value))
    .filter((value): value is string => Boolean(value));
  const children = (node.children ?? []).map((child) => serializeStageNode(child as any)).join('');
  const openTag = attrs.length ? `<${node.type} ${attrs.join(' ')}>` : `<${node.type}>`;
  return `${openTag}${children}</${node.type}>`;
}

function buildRenderState(document: StudioDocument): StudioState {
  return {
    document,
    ui: createInitialUiState(),
  };
}

function createRenderContext() {
  return {
    previewMode: false,
    playheadMs: 0,
    sceneDurationMs: 15000,
    hovered: false,
    active: false,
    triggerWidgetAction: (_trigger: ActionNode['trigger'], _metadata?: Record<string, unknown>) => {},
    executeAction: () => {},
  };
}

function renderStageToHtml(document: StudioDocument, widgetId: string): string {
  const state = buildRenderState(document);
  const widget = state.document.widgets[widgetId];
  if (!widget) throw new Error(`Parity fixture widget not found: ${widgetId}`);

  const definition = getWidgetDefinition(widget.type);
  if (!definition.renderStage) throw new Error(`Widget ${widget.type} does not expose renderStage`);

  const renderer = create(
    <div data-parity-root={widget.type}>
      {definition.renderStage(widget, createRenderContext())}
    </div>,
  );

  return serializeStageNode(renderer.toJSON() as any);
}

function renderExportToHtml(document: StudioDocument, widgetId: string, assetPathMap: Record<string, string> = {}): string {
  const state = buildRenderState(document);
  const portableProject = buildPortableProjectExport(state);
  const portableWidget = portableProject.scenes.flatMap((scene) => scene.widgets).find((widget) => widget.id === widgetId);
  if (!portableWidget) throw new Error(`Portable export widget not found: ${widgetId}`);

  return renderWidgetExport({
    node: portableWidget,
    state,
    assetPathMap,
    channel: state.document.metadata.release.targetChannel,
  });
}

export function runParityTest(spec: ParitySpec): void {
  describe(`stage/export parity: ${spec.moduleType}`, () => {
    spec.fixtures.forEach((fixture) => {
      it(fixture.name, () => {
        const stageHtml = normalizeHtml(renderStageToHtml(fixture.document, fixture.widgetId));
        const exportHtml = normalizeHtml(renderExportToHtml(fixture.document, fixture.widgetId, fixture.assetPathMap));
        const diff = domDiff(stageHtml, exportHtml);
        expect(diff.criticalDiffs).toEqual([]);
      });
    });
  });
}
