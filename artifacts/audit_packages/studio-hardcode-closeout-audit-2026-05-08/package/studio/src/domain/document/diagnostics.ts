import type { ExportValidationIssue } from './export-validation';
import { validateExport } from './export-validation';
import type { FeedRecord, SceneNode, StudioState, WidgetNode } from './types';

export type DiagnosticIssue = ExportValidationIssue & {
  category: 'integrity' | 'content' | 'runtime' | 'export';
};

function pushUnique(target: DiagnosticIssue[], issue: DiagnosticIssue): void {
  const key = `${issue.level}:${issue.scope}:${issue.targetId ?? ''}:${issue.message}`;
  if (target.some((item) => `${item.level}:${item.scope}:${item.targetId ?? ''}:${item.message}` === key)) return;
  target.push(issue);
}

function validateSceneStructure(scene: SceneNode, state: StudioState, issues: DiagnosticIssue[]): void {
  if (scene.durationMs <= 0) {
    pushUnique(issues, { category: 'integrity', level: 'error', scope: 'scene', targetId: scene.id, message: `Scene "${scene.name}" has invalid duration.` });
  }
  scene.widgetIds.forEach((widgetId) => {
    if (!state.document.widgets[widgetId]) {
      pushUnique(issues, { category: 'integrity', level: 'error', scope: 'scene', targetId: scene.id, message: `Scene "${scene.name}" references missing widget ${widgetId}.` });
    }
  });
  if (scene.flow?.nextSceneId && !state.document.scenes.some((item) => item.id === scene.flow?.nextSceneId)) {
    pushUnique(issues, { category: 'runtime', level: 'error', scope: 'scene', targetId: scene.id, message: `Scene "${scene.name}" points to a missing next scene.` });
  }
  (scene.flow?.branches ?? []).forEach((branch, index) => {
    if (!state.document.scenes.some((item) => item.id === branch.targetSceneId)) {
      pushUnique(issues, { category: 'runtime', level: 'error', scope: 'scene', targetId: scene.id, message: `Branch ${index + 1} on "${scene.name}" points to a missing target scene.` });
    }
  });
}

function validateWidgetStructure(widget: WidgetNode, state: StudioState, issues: DiagnosticIssue[]): void {
  if (!state.document.scenes.some((scene) => scene.id === widget.sceneId)) {
    pushUnique(issues, { category: 'integrity', level: 'error', scope: 'widget', targetId: widget.id, message: `${widget.name} belongs to a missing scene.` });
  }
  if (widget.frame.width <= 0 || widget.frame.height <= 0) {
    pushUnique(issues, { category: 'integrity', level: 'error', scope: 'widget', targetId: widget.id, message: `${widget.name} has non-positive size.` });
  }
  if (widget.timeline.startMs > widget.timeline.endMs) {
    pushUnique(issues, { category: 'runtime', level: 'error', scope: 'widget', targetId: widget.id, message: `${widget.name} starts after it ends on the timeline.` });
  }
  if (widget.parentId && !state.document.widgets[widget.parentId]) {
    pushUnique(issues, { category: 'integrity', level: 'error', scope: 'widget', targetId: widget.id, message: `${widget.name} points to a missing parent group.` });
  }
  (widget.childIds ?? []).forEach((childId) => {
    const child = state.document.widgets[childId];
    if (!child) {
      pushUnique(issues, { category: 'integrity', level: 'error', scope: 'widget', targetId: widget.id, message: `${widget.name} references missing child ${childId}.` });
      return;
    }
    if (child.parentId !== widget.id) {
      pushUnique(issues, { category: 'integrity', level: 'warning', scope: 'widget', targetId: widget.id, message: `${widget.name} and ${child.name} are out of sync as a group.` });
    }
  });
  Object.entries(widget.bindings ?? {}).forEach(([prop, binding]) => {
    const records = state.document.feeds[binding.source] ?? [];
    if (!records.length) {
      pushUnique(issues, { category: 'content', level: 'warning', scope: 'widget', targetId: widget.id, message: `${widget.name} binds ${prop} to an empty ${binding.source} dataset.` });
      return;
    }
    if (!records.some((record) => binding.field in record.values)) {
      pushUnique(issues, { category: 'content', level: 'warning', scope: 'widget', targetId: widget.id, message: `${widget.name} binds ${prop} to missing field ${binding.field} in ${binding.source}.` });
    }
  });
}

function validateFeeds(state: StudioState, issues: DiagnosticIssue[]): void {
  (Object.entries(state.document.feeds) as Array<[string, FeedRecord[]]>).forEach(([source, records]) => {
    const ids = new Set<string>();
    records.forEach((record) => {
      if (!record.id.trim()) {
        pushUnique(issues, { category: 'content', level: 'error', scope: 'document', message: `${source} feed has a record without id.` });
      }
      if (ids.has(record.id)) {
        pushUnique(issues, { category: 'content', level: 'error', scope: 'document', message: `${source} feed has duplicate record id "${record.id}".` });
      }
      ids.add(record.id);
    });
  });
}

export function collectDiagnostics(state: StudioState): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = validateExport(state).map((issue) => ({ ...issue, category: 'export' }));
  validateFeeds(state, issues);
  state.document.scenes.forEach((scene) => validateSceneStructure(scene, state, issues));
  Object.values(state.document.widgets).forEach((widget) => validateWidgetStructure(widget, state, issues));

  const widgetNameCount = new Map<string, number>();
  Object.values(state.document.widgets).forEach((widget) => {
    const key = widget.name.trim().toLowerCase();
    widgetNameCount.set(key, (widgetNameCount.get(key) ?? 0) + 1);
  });
  Object.entries(Object.fromEntries(widgetNameCount)).forEach(([name, count]) => {
    if (name && count > 1) {
      pushUnique(issues, { category: 'content', level: 'warning', scope: 'document', message: `Multiple widgets share the name "${name}".` });
    }
  });

  return issues;
}

export function buildDiagnosticSummary(state: StudioState): {
  errors: number;
  warnings: number;
  widgets: number;
  scenes: number;
  actions: number;
  bindings: number;
  hiddenWidgets: number;
} {
  const issues = collectDiagnostics(state);
  const bindings = Object.values(state.document.widgets).reduce((sum, widget) => sum + Object.keys(widget.bindings ?? {}).length, 0);
  return {
    errors: issues.filter((item) => item.level === 'error').length,
    warnings: issues.filter((item) => item.level === 'warning').length,
    widgets: Object.keys(state.document.widgets).length,
    scenes: state.document.scenes.length,
    actions: Object.keys(state.document.actions).length,
    bindings,
    hiddenWidgets: Object.values(state.document.widgets).filter((widget) => widget.hidden).length,
  };
}
