import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHashTabState } from '../../../platform/use-hash-tab-state';

function HashTabHarness({
  routePath,
  onRender,
}: {
  routePath: string;
  onRender(tab: 'a' | 'b'): void;
}): JSX.Element {
  const [tab] = useHashTabState(routePath, ['a', 'b'] as const, 'a');
  onRender(tab);
  return <div>{tab}</div>;
}

describe('useHashTabState', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not loop when routePath is recomputed with the same value', () => {
    vi.stubGlobal('window', {
      location: { hash: '#/hub?tab=b' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const renders: Array<'a' | 'b'> = [];
    let root!: ReactTestRenderer;

    act(() => {
      root = create(<HashTabHarness routePath="/hub" onRender={(tab) => renders.push(tab)} />);
    });

    const before = renders.length;

    act(() => {
      root.update(<HashTabHarness routePath={`/hub`} onRender={(tab) => renders.push(tab)} />);
    });

    const after = renders.length;
    expect(after - before).toBeLessThanOrEqual(2);
    expect(renders.at(-1)).toBe('b');
  });
});
