import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { Tooltip } from '../../../shared/ui/Tooltip';

describe('Tooltip', () => {
  it('shows and hides tooltip content on hover', () => {
    let root: ReactTestRenderer;

    act(() => {
      root = create(
        <Tooltip content="Helpful hint">
          <button type="button">Hover me</button>
        </Tooltip>,
      );
    });

    const shell = root!.root.findByProps({ className: 'tooltip-shell' });
    const initialTooltip = root!.root.findByProps({ role: 'tooltip' });
    expect(initialTooltip.props.hidden).toBe(true);
    expect(root!.root.findByType('button').props['aria-describedby']).toBeTruthy();

    act(() => {
      shell.props.onMouseEnter();
    });

    const tooltip = root!.root.findByProps({ role: 'tooltip' });
    expect(tooltip.props.className).toContain('tooltip-bubble--top');
    expect(tooltip.props.hidden).toBe(false);
    expect(tooltip.children).toEqual(['Helpful hint']);

    act(() => {
      shell.props.onMouseLeave();
    });

    expect(root!.root.findByProps({ role: 'tooltip' }).props.hidden).toBe(true);
  });

  it('returns the child unchanged when disabled', () => {
    const root = create(
      <Tooltip content="Helpful hint" disabled>
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    expect(root.root.findByType('button').children).toEqual(['Hover me']);
    expect(root.root.findAllByProps({ role: 'tooltip' })).toHaveLength(0);
  });
});
