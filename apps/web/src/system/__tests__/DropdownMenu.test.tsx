import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../primitives/Button';
import { DropdownMenu } from '../primitives/DropdownMenu';

describe('DropdownMenu', () => {
  it('opens on trigger click', () => {
    render(
      <DropdownMenu
        trigger={<Button>Open menu</Button>}
        items={[{ id: 'view', label: 'View detail', onSelect: () => {} }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('closes on outside click', () => {
    render(
      <div>
        <button type="button">Outside</button>
        <DropdownMenu
          trigger={<Button>Open menu</Button>}
          items={[{ id: 'view', label: 'View detail', onSelect: () => {} }]}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('supports keyboard navigation and close on escape', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    render(
      <DropdownMenu
        trigger={<Button>Open menu</Button>}
        items={[{ id: 'view', label: 'View detail', onSelect: () => {} }]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'View detail' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('fires onSelect and closes', () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        trigger={<Button>Open menu</Button>}
        items={[{ id: 'view', label: 'View detail', onSelect }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'View detail' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does not allow disabled items to fire', () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        trigger={<Button>Open menu</Button>}
        items={[{ id: 'pause', label: 'Pause delivery', onSelect, disabled: true }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const item = screen.getByRole('menuitem', { name: 'Pause delivery' });
    fireEvent.click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
