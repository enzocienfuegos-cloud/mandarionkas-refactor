import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  CommandPaletteProvider,
  useCommandPalette,
  type CommandItem,
} from '../command-palette/CommandPalette';

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

describe('CommandPalette', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows recent commands first and filters contextual commands by entity scope', async () => {
    const openCampaign = vi.fn((close: () => void) => close());
    const createCampaign = vi.fn((close: () => void) => close());

    window.localStorage.setItem('cmd-palette:recent', JSON.stringify(['open-campaign']));

    const items: CommandItem[] = [
      {
        id: 'open-campaign',
        label: 'Open campaign',
        group: 'Navigation',
        perform: openCampaign,
        contextScope: { entity: 'campaign' },
      },
      {
        id: 'create-campaign',
        label: 'Create campaign',
        group: 'Actions',
        perform: createCampaign,
      },
      {
        id: 'edit-creative',
        label: 'Edit creative',
        group: 'Actions',
        perform: vi.fn((close: () => void) => close()),
        contextScope: { entity: 'creative' },
      },
    ];

    render(
      <CommandPaletteProvider initialItems={items} context={{ entity: 'campaign', id: 'cmp-1' }}>
        <OpenPaletteButton />
      </CommandPaletteProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open palette' }));

    expect(screen.getByText('Recent')).toBeTruthy();
    expect(screen.getByText('Open campaign')).toBeTruthy();
    expect(screen.getByText('Create campaign')).toBeTruthy();
    expect(screen.queryByText('Edit creative')).toBeNull();

    fireEvent.click(screen.getByText('Create campaign'));

    await waitFor(() => {
      expect(createCampaign).toHaveBeenCalledTimes(1);
    });

    expect(JSON.parse(window.localStorage.getItem('cmd-palette:recent') ?? '[]')).toEqual(['create-campaign', 'open-campaign']);
  });
});
