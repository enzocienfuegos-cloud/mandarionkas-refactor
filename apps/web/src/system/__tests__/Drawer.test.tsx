import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Drawer } from '../primitives/Drawer';

describe('Drawer', () => {
  it('closes on backdrop click and escape', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Drawer open onClose={onClose} title="Audit drawer">
        <button type="button">Focusable child</button>
      </Drawer>,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /close drawer/i })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <Drawer open onClose={onClose} title="Audit drawer">
        <button type="button">Focusable child</button>
      </Drawer>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders bottom drawers with the correct layout classes', () => {
    render(
      <Drawer open onClose={() => {}} side="bottom" title="Bottom drawer">
        <div>Content</div>
      </Drawer>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('bottom-0');
    expect(dialog.className).toContain('rounded-t-3xl');
  });
});
