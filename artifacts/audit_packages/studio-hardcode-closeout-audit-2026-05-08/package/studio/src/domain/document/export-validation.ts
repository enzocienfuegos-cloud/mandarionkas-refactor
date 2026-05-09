import type { StudioState } from './types';

export type ExportValidationIssue = {
  level: 'error' | 'warning';
  scope: 'document' | 'scene' | 'widget' | 'action';
  targetId?: string;
  message: string;
};

export function validateExport(state: StudioState): ExportValidationIssue[] {
  const issues: ExportValidationIssue[] = [];
  if (!state.document.name.trim()) {
    issues.push({ level: 'warning', scope: 'document', message: 'Document name is empty.' });
  }
  if (!state.document.scenes.length) {
    issues.push({ level: 'error', scope: 'document', message: 'Document has no scenes.' });
  }
  state.document.scenes.forEach((scene) => {
    if (!scene.widgetIds.length) {
      issues.push({ level: 'warning', scope: 'scene', targetId: scene.id, message: `Scene "${scene.name}" has no widgets.` });
    }
  });
  Object.values(state.document.widgets).forEach((widget) => {
    if (widget.type === 'cta') {
      const actionIds = Object.values(state.document.actions).filter((action) => action.widgetId === widget.id);
      const hasUrl = actionIds.some((action) => action.type === 'open-url' && action.url);
      if (!hasUrl) {
        issues.push({ level: 'warning', scope: 'widget', targetId: widget.id, message: `${widget.name} has no open-url action.` });
      }
    }
    if (widget.frame.width <= 0 || widget.frame.height <= 0) {
      issues.push({ level: 'error', scope: 'widget', targetId: widget.id, message: `${widget.name} has invalid frame size.` });
    }
  });
  Object.values(state.document.actions).forEach((action) => {
    if (action.type === 'open-url' && !action.url) {
      issues.push({ level: 'error', scope: 'action', targetId: action.id, message: `Action ${action.id} is missing URL.` });
    }
    if ((action.type === 'show-widget' || action.type === 'hide-widget' || action.type === 'toggle-widget' || action.type === 'set-text') && !action.targetWidgetId) {
      issues.push({ level: 'error', scope: 'action', targetId: action.id, message: `Action ${action.id} is missing target widget.` });
    }
  });
  return issues;
}
