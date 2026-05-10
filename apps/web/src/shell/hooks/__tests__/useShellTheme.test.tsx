import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useShellTheme } from '../useShellTheme';
import { THEME_PREFERENCE_KEY } from '../../../shared/theme';

const mocks = vi.hoisted(() => ({
  syncPreferencesFromServer: vi.fn(),
  loadPreference: vi.fn(),
  savePreference: vi.fn(),
  applyTheme: vi.fn(),
  persistTheme: vi.fn(),
}));

vi.mock('../../../shared/preferences', () => ({
  loadPreference: mocks.loadPreference,
  savePreference: mocks.savePreference,
  syncPreferencesFromServer: mocks.syncPreferencesFromServer,
}));

vi.mock('../../../shared/theme', async () => {
  const actual = await vi.importActual<typeof import('../../../shared/theme')>('../../../shared/theme');
  return {
    ...actual,
    getInitialTheme: () => 'dark',
    applyTheme: mocks.applyTheme,
    persistTheme: mocks.persistTheme,
  };
});

describe('useShellTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadPreference.mockReset();
    mocks.loadPreference
      .mockReturnValueOnce(undefined)
      .mockReturnValue('light');
    mocks.syncPreferencesFromServer.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ theme: 'light' }), 50)),
    );
  });

  it('does not push the local default before the first sync completes', async () => {
    const { result } = renderHook(() => useShellTheme());

    expect(mocks.savePreference).not.toHaveBeenCalledWith(THEME_PREFERENCE_KEY, 'dark');

    await act(async () => {
      await result.current.sync();
    });

    expect(mocks.savePreference).not.toHaveBeenCalledWith(THEME_PREFERENCE_KEY, 'dark');

    act(() => {
      result.current.toggle();
    });

    expect(mocks.savePreference).toHaveBeenCalledWith(THEME_PREFERENCE_KEY, 'dark');
  });
});
