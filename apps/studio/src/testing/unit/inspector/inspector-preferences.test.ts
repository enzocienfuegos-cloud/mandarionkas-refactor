import { beforeEach, describe, expect, it } from 'vitest';
import { getAccordionOpenState, setAccordionOpenState } from '../../../inspector/inspector-preferences';

describe('inspector accordion preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('returns the provided fallback when no preference is stored', () => {
    expect(getAccordionOpenState('image', 'keyframes', true)).toBe(true);
    expect(getAccordionOpenState('image', 'keyframes', false)).toBe(false);
  });

  it('persists accordion state per widget type and panel key', () => {
    setAccordionOpenState('image', 'keyframes', true);
    setAccordionOpenState('text', 'keyframes', false);

    expect(getAccordionOpenState('image', 'keyframes', false)).toBe(true);
    expect(getAccordionOpenState('text', 'keyframes', true)).toBe(false);
    expect(getAccordionOpenState('image', 'fill', false)).toBe(false);
  });
});
