import { describe, expect, it } from 'vitest';
import { collectDiagnostics, buildDiagnosticSummary } from '../../../domain/document/diagnostics';
import { createInitialState } from '../../../domain/document/factories';

describe('document diagnostics', () => {
  it('detects broken scene/widget/feed references', () => {
    const state = createInitialState();
    const scene = state.document.scenes[0];
    scene.durationMs = 0;
    scene.widgetIds.push('missing_widget');
    scene.flow = { nextSceneId: 'missing_scene' };
    state.document.feeds.product.push({ id: 'product_summer', label: 'Duplicate', values: { title: 'dup' } });

    const issues = collectDiagnostics(state);
    expect(issues.some((issue) => issue.message.includes('invalid duration'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('missing widget'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('missing next scene'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('duplicate record id'))).toBe(true);
  });

  it('builds a useful summary', () => {
    const state = createInitialState();
    const summary = buildDiagnosticSummary(state);
    expect(summary.scenes).toBe(1);
    expect(summary.widgets).toBe(0);
    expect(summary.errors).toBeGreaterThanOrEqual(0);
    expect(summary.warnings).toBeGreaterThanOrEqual(0);
  });
});
