import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SavedViewsMenu } from '../SavedViewsMenu';
import { ToastProvider } from '../../feedback/Toast';
import { ConfirmProvider } from '../../feedback/Confirm';

const mocks = vi.hoisted(() => ({
  listSavedViews: vi.fn(),
  createSavedView: vi.fn(),
  updateSavedView: vi.fn(),
  deleteSavedView: vi.fn(),
}));

vi.mock('../../../shared/saved-views', () => ({
  listSavedViews: mocks.listSavedViews,
  createSavedView: mocks.createSavedView,
  updateSavedView: mocks.updateSavedView,
  deleteSavedView: mocks.deleteSavedView,
  buildSavedViewUrl: (id: string) => `https://example.test/?view=${id}`,
}));

const VIEW = {
  id: 'view-1',
  name: 'Original',
  surface: 'campaigns',
  filters: { status: 'live' },
  sort: null,
  columns: [],
  isShared: false,
  canDelete: true,
};

function renderMenu(overrides = {}) {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <SavedViewsMenu
          surface="campaigns"
          currentFilters={{ status: 'paused' }}
          currentViewId="view-1"
          onApplyView={vi.fn()}
          {...overrides}
        />
      </ConfirmProvider>
    </ToastProvider>,
  );
}

describe('SavedViewsMenu update flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listSavedViews.mockResolvedValue([VIEW]);
    mocks.updateSavedView.mockResolvedValue({ ...VIEW, name: 'Renamed' });
    mocks.createSavedView.mockResolvedValue({ ...VIEW, id: 'view-2', name: 'Renamed' });
  });

  it('clicking Update calls updateSavedView even when the name changed', async () => {
    renderMenu();
    await waitFor(() => expect(mocks.listSavedViews).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /original/i }));
    fireEvent.click(await screen.findByText('Save current view'));

    const input = await screen.findByLabelText(/view name/i);
    fireEvent.change(input, { target: { value: 'Renamed' } });

    fireEvent.click(screen.getByRole('button', { name: /update "original"/i }));

    await waitFor(() => expect(mocks.updateSavedView).toHaveBeenCalledTimes(1));
    expect(mocks.updateSavedView).toHaveBeenCalledWith('view-1', expect.objectContaining({
      name: 'Renamed',
    }));
    expect(mocks.createSavedView).not.toHaveBeenCalled();
  });

  it('clicking Save as new always calls createSavedView', async () => {
    renderMenu();
    await waitFor(() => expect(mocks.listSavedViews).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /original/i }));
    fireEvent.click(await screen.findByText('Save current view'));

    const input = await screen.findByLabelText(/view name/i);
    fireEvent.change(input, { target: { value: 'Original' } });

    fireEvent.click(screen.getByRole('button', { name: /save as new/i }));

    await waitFor(() => expect(mocks.createSavedView).toHaveBeenCalledTimes(1));
    expect(mocks.updateSavedView).not.toHaveBeenCalled();
  });
});
