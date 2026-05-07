import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../primitives/Button';
import { Drawer } from '../primitives/Drawer';

describe('Drawer', () => {
  it('renders backdrop and drawer when open', () => {
    render(
      <Drawer open onClose={() => {}} title="Campaign detail">
        <Button>Inside</Button>
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Close drawer' }).length).toBeGreaterThan(0);
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Campaign detail">
        <Button>Inside</Button>
      </Drawer>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Close drawer' })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on escape', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Campaign detail">
        <Button>Inside</Button>
      </Drawer>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('traps focus inside the drawer', () => {
    render(
      <Drawer
        open
        onClose={() => {}}
        title="Campaign detail"
        footer={<Button>Save</Button>}
      >
        <Button>Inside</Button>
      </Drawer>,
    );
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons[1];
    const saveButton = screen.getByRole('button', { name: 'Save' });
    saveButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);
  });
});
