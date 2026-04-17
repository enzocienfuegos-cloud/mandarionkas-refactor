import type { StudioState, WidgetNode, WidgetType } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { PortableExportWidget } from '../../export/portable';

export type InspectorSectionKey =
  | 'position-size'
  | 'text-content'
  | 'fill'
  | 'timing'
  | 'module-config'
  | 'states'
  | 'data-bindings'
  | 'variants'
  | 'conditions'
  | 'document-meta';

export type WidgetInspectorTabId = 'basics' | 'behavior' | 'data';

export type WidgetInspectorPanelKey =
  | 'position-size'
  | 'text-content'
  | 'widget-fields'
  | 'module-config'
  | 'fill'
  | 'timing'
  | 'conditions'
  | 'actions'
  | 'states'
  | 'keyframes'
  | 'data-bindings'
  | 'variants';

export type WidgetInspectorTabSpec = {
  id: WidgetInspectorTabId;
  label?: string;
  panels: WidgetInspectorPanelKey[];
};

export type WidgetFieldSpec = {
  key: string;
  label?: string;
  type?: 'text' | 'number' | 'textarea' | 'checkbox';
};

export type WidgetDefinition = {
  type: WidgetType;
  label: string;
  category: 'content' | 'media' | 'interactive' | 'layout';
  defaults: (sceneId: string, zIndex: number) => WidgetNode;
  inspectorSections: InspectorSectionKey[];
  inspectorTabs?: WidgetInspectorTabSpec[];
  inspectorTitle?: string;
  inspectorFields?: WidgetFieldSpec[];
  renderLabel: (node: WidgetNode) => string;
  renderStage?: (node: WidgetNode, ctx: RenderContext) => JSX.Element;
  renderInspector?: (node: WidgetNode) => JSX.Element;
  renderExport?: (node: WidgetNode, state: StudioState) => string;
  buildPortableExport?: (node: WidgetNode, state: StudioState) => Partial<PortableExportWidget> | void;
};

export function createInspectorTabs(tabs: WidgetInspectorTabSpec[]): WidgetInspectorTabSpec[] {
  return tabs.map((tab) => ({ ...tab, panels: [...tab.panels] }));
}

export function getWidgetFieldPanelKey(definition: Pick<WidgetDefinition, 'inspectorFields' | 'renderInspector' | 'inspectorSections'>): WidgetInspectorPanelKey | null {
  if (definition.renderInspector || definition.inspectorFields?.length) return 'widget-fields';
  if (definition.inspectorSections.includes('module-config')) return 'module-config';
  return null;
}

export function resolveInspectorTabs(definition: WidgetDefinition): WidgetInspectorTabSpec[] {
  if (definition.inspectorTabs?.length) return createInspectorTabs(definition.inspectorTabs);

  const fieldPanel = getWidgetFieldPanelKey(definition);
  const basicsPanels: WidgetInspectorPanelKey[] = ['position-size'];
  if (definition.inspectorSections.includes('text-content')) basicsPanels.push('text-content');
  if (fieldPanel) basicsPanels.push(fieldPanel);
  if (definition.inspectorSections.includes('fill')) basicsPanels.push('fill');
  if (definition.inspectorSections.includes('timing')) basicsPanels.push('timing');

  const behaviorPanels: WidgetInspectorPanelKey[] = ['conditions', 'actions'];
  if (definition.inspectorSections.includes('states')) behaviorPanels.push('states');
  behaviorPanels.push('keyframes');

  const dataPanels: WidgetInspectorPanelKey[] = [];
  if (definition.inspectorSections.includes('data-bindings')) dataPanels.push('data-bindings');
  if (definition.inspectorSections.includes('variants')) dataPanels.push('variants');

  const tabs: WidgetInspectorTabSpec[] = [
    { id: 'basics', label: 'Basics', panels: basicsPanels },
    { id: 'behavior', label: 'Behavior', panels: behaviorPanels },
  ];

  if (dataPanels.length) tabs.push({ id: 'data', label: 'Data', panels: dataPanels });
  return tabs;
}
