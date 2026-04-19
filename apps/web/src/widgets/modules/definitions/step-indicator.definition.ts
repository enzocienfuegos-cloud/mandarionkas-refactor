import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderStepIndicatorStage } from '../step-indicator.renderer';
import { StepIndicatorInspector } from '../step-indicator.inspector';

export const StepIndicatorDefinition = createModuleDefinition({
  type: 'step-indicator',
  label: 'Step Indicator',
  category: 'interactive',
  frame: { x: 40, y: 40, width: 120, height: 24, rotation: 0 },
  props: { total: 3, current: 1, doneColor: '#ffffff', pendingColor: 'rgba(255,255,255,0.3)', size: 10, gap: 10 },
  style: { backgroundColor: 'transparent', accentColor: '#ffffff', color: '#ffffff' },
  renderStage: renderStepIndicatorStage,
  renderInspector: (node) => createElement(StepIndicatorInspector, { node }),
  exportDetail: 'Bocadeli World Cup step indicator',
});
