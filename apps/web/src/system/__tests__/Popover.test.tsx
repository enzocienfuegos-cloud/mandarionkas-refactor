import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Popover } from '../primitives/Popover';

describe('Popover', () => {
  it('closes on outside click and escape', () => {
    const onClose = vi.fn();

    function Harness() {
      const anchorRef = React.useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={anchorRef} type="button">Anchor</button>
          <button type="button">Outside</button>
          <Popover open anchorRef={anchorRef} onClose={onClose}>
            <div>Popover content</div>
          </Popover>
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole('button', { name: /outside/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
