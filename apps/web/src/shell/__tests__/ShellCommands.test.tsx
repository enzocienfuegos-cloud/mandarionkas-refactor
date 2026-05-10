import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider, CommandPaletteProvider, useCommandPalette } from '../../system';
import { ShellCommands } from '../ShellCommands';

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

function OpenPaletteButton() {
  const palette = useCommandPalette();
  return (
    <button type="button" onClick={palette.open}>
      Open palette
    </button>
  );
}

describe('ShellCommands', () => {
  it('registers contextual tool commands only when the palette context matches', () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <CommandPaletteProvider context={{ entity: 'tools' }}>
            <ShellCommands
              onSignOut={vi.fn()}
              onToggleTheme={vi.fn()}
              themeMode="light"
            />
            <OpenPaletteButton />
          </CommandPaletteProvider>
        </MemoryRouter>
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open palette' }));

    expect(screen.getByText('Open webhook tester')).toBeTruthy();
    expect(screen.getByText('Open macro builder')).toBeTruthy();
    expect(screen.queryByText('Open webhook settings')).toBeNull();
  });
});
