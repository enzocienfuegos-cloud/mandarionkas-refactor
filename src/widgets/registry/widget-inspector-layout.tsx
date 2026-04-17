import type { WidgetNode, ActionNode } from '../../domain/document/types';
import { PositionSection } from '../../inspector/sections/PositionSection';
import { TextSection } from '../../inspector/sections/TextSection';
import { ModuleConfigSection } from '../../inspector/sections/ModuleConfigSection';
import { FillSection } from '../../inspector/sections/FillSection';
import { TimingSection } from '../../inspector/sections/TimingSection';
import { StatesSection } from '../../inspector/sections/StatesSection';
import { DataBindingsSection } from '../../inspector/sections/DataBindingsSection';
import { VariantsSection } from '../../inspector/sections/VariantsSection';
import { ConditionsSection } from '../../inspector/sections/ConditionsSection';
import { ActionsSection } from '../../inspector/sections/ActionsSection';
import { KeyframesSection } from '../../inspector/sections/KeyframesSection';
import type { WidgetDefinition, WidgetInspectorPanelKey, WidgetInspectorTabSpec } from './widget-definition';
import { resolveInspectorTabs } from './widget-definition';
import { WidgetFieldInspectorSection } from './widget-field-inspector';

export type WidgetInspectorRenderContext = {
  widget: WidgetNode;
  definition: WidgetDefinition;
  playheadMs: number;
  actions: ActionNode[];
};

export function getWidgetInspectorTabs(definition: WidgetDefinition): WidgetInspectorTabSpec[] {
  return resolveInspectorTabs(definition);
}

export function getWidgetBehaviorPanelCount(definition: WidgetDefinition): number {
  return getWidgetInspectorTabs(definition)
    .find((tab) => tab.id === 'behavior')
    ?.panels.length ?? 0;
}

function renderWidgetFieldPanel({ widget, definition }: Pick<WidgetInspectorRenderContext, 'widget' | 'definition'>): JSX.Element | null {
  if (definition.renderInspector) return definition.renderInspector(widget);
  if (definition.inspectorFields?.length) {
    return <WidgetFieldInspectorSection widget={widget} title={definition.inspectorTitle ?? definition.label} fields={definition.inspectorFields} />;
  }
  return null;
}

export function renderWidgetInspectorPanel(key: WidgetInspectorPanelKey, context: WidgetInspectorRenderContext): JSX.Element | null {
  const { widget, definition, playheadMs, actions } = context;

  switch (key) {
    case 'position-size':
      return <PositionSection widget={widget} />;
    case 'text-content':
      return <TextSection widget={widget} />;
    case 'widget-fields':
      return renderWidgetFieldPanel({ widget, definition });
    case 'module-config':
      return <ModuleConfigSection widget={widget} />;
    case 'fill':
      return <FillSection widget={widget} />;
    case 'timing':
      return <TimingSection widget={widget} />;
    case 'conditions':
      return <ConditionsSection widget={widget} />;
    case 'actions':
      return <ActionsSection widget={widget} actions={actions} />;
    case 'states':
      return <StatesSection widget={widget} />;
    case 'keyframes':
      return <KeyframesSection widget={widget} playheadMs={playheadMs} />;
    case 'data-bindings':
      return <DataBindingsSection widget={widget} />;
    case 'variants':
      return <VariantsSection widget={widget} />;
    default:
      return null;
  }
}

export function renderWidgetInspectorTab(tab: WidgetInspectorTabSpec, context: WidgetInspectorRenderContext): JSX.Element {
  return (
    <>
      {tab.panels.map((panelKey) => {
        const panel = renderWidgetInspectorPanel(panelKey, context);
        return panel ? <div key={panelKey}>{panel}</div> : null;
      })}
    </>
  );
}
