import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../system/feedback/Toast';
import TagSnippetPanel from '../TagSnippetPanel';

const writeText = vi.fn().mockResolvedValue(undefined);

Object.assign(navigator, {
  clipboard: {
    writeText,
  },
});

describe('TagSnippetPanel', () => {
  it('renders system snippet tabs and macro audit for the selected DSP', async () => {
    render(
      <ToastProvider>
        <TagSnippetPanel
          tag={{
            id: 'tag-123',
            name: 'Homepage Display',
            format: 'display',
            width: 300,
            height: 250,
          }}
          campaignDsp="Basis"
          diagnostics={null}
        />
      </ToastProvider>,
    );

    expect(screen.getByRole('tab', { name: 'Display JS' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Display Iframe' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Display INS' })).toBeTruthy();
    expect(screen.getByText('Macro')).toBeTruthy();
    expect(screen.getByText('{clickMacroEnc}')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Display Iframe' }));
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByText('Copied')).toBeTruthy();
  });
});
