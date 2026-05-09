import { describe, expect, it } from 'vitest';
import { getProjectStarters } from '../../../app/shell/topbar/project-starters';
import { listTemplates } from '../../../templates/library/registry';

describe('template library registry', () => {
  it('loads a broad vertical library into the starter system', () => {
    const templates = listTemplates();
    const starterIds = getProjectStarters().map((starter) => starter.id);
    const verticals = new Set(templates.map((template) => template.metadata.vertical));

    expect(templates.length).toBeGreaterThanOrEqual(11);
    expect(verticals).toEqual(new Set(['auto', 'cpg', 'custom', 'ecommerce', 'finance', 'sports']));
    expect(starterIds).toContain('ecommerce-flash-drop');
    expect(starterIds).toContain('finance-credit-boost');
    expect(starterIds).toContain('sports-matchday-countdown');
  });
});
