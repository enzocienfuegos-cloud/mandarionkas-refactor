import type { ComponentType } from 'react';
import type { StudioState } from '../domain/document/types';

export type DocumentInspectorTabId = string;
export type DocumentInspectorPanelKey = string;

export type DocumentInspectorTabSpec = {
  id: DocumentInspectorTabId;
  label: string;
  panels: DocumentInspectorPanelKey[];
  visible?: (state: StudioState) => boolean;
};

export type DocumentInspectorPanelSpec = {
  key: DocumentInspectorPanelKey;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  visible?: (state: StudioState) => boolean;
  Component: ComponentType;
};

const tabs: DocumentInspectorTabSpec[] = [];
const panels = new Map<DocumentInspectorPanelKey, DocumentInspectorPanelSpec>();

export function registerDocumentInspectorTab(spec: DocumentInspectorTabSpec): void {
  if (tabs.some((tab) => tab.id === spec.id)) return;
  tabs.push(spec);
}

export function registerDocumentInspectorPanel(spec: DocumentInspectorPanelSpec): void {
  panels.set(spec.key, spec);
}

export function getDocumentInspectorTabs(state: StudioState): DocumentInspectorTabSpec[] {
  return tabs.filter((tab) => (tab.visible ? tab.visible(state) : true));
}

export function getDocumentInspectorPanel(key: DocumentInspectorPanelKey): DocumentInspectorPanelSpec | undefined {
  return panels.get(key);
}

export function getDocumentInspectorPanelsForTab(
  tab: DocumentInspectorTabSpec,
  state: StudioState,
): DocumentInspectorPanelSpec[] {
  return tab.panels
    .map((key) => getDocumentInspectorPanel(key))
    .filter((panel): panel is DocumentInspectorPanelSpec => Boolean(panel))
    .filter((panel) => (panel.visible ? panel.visible(state) : true));
}
