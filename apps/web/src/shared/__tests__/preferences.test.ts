import { describe, expect, it } from 'vitest';
import { buildServerPreferences } from '../preferences';

describe('buildServerPreferences', () => {
  it('returns an empty payload when no explicit local preferences exist', () => {
    expect(buildServerPreferences({})).toEqual({});
  });

  it('only includes the explicit theme when that is the only local preference', () => {
    expect(buildServerPreferences({ 'ui.theme': 'light' })).toEqual({ theme: 'light' });
  });

  it('includes only real density selections', () => {
    expect(buildServerPreferences({ 'dusk:density:campaigns': 'compact' })).toEqual({
      densityByTable: {
        campaigns: 'compact',
      },
    });
  });
});
