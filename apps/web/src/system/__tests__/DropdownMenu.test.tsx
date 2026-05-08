import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DropdownMenu } from '../primitives/DropdownMenu';
import { Button } from '../primitives/Button';

describe('DropdownMenu', () => {
  it('fires onSelect when a menu item is clicked', () => {
    const onSelect = vi.fn();

    render(
      <DropdownMenu
        trigger={<Button>Open</Button>}
        items={[{ id: 'a', label: 'Action A', onSelect }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /action a/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking outside both trigger and menu', () => {
    render(
      <>
        <button data-testid="outside">Outside</button>
        <DropdownMenu
          trigger={<Button>Open</Button>}
          items={[{ id: 'a', label: 'Action A', onSelect: () => {} }]}
        />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
