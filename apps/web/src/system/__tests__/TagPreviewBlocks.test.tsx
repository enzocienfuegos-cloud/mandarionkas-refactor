import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../feedback/Toast';
import { TagSnippetBlock } from '../preview/TagSnippetBlock';
import { MacroResolver } from '../preview/MacroResolver';
import { TagDiagnostics } from '../preview/TagDiagnostics';

const writeText = vi.fn();
const openWindow = vi.fn();

Object.assign(navigator, {
  clipboard: {
    writeText,
  },
});

Object.defineProperty(window, 'open', {
  configurable: true,
  value: openWindow,
});

describe('Tag preview blocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies the active snippet and switches modes', async () => {
    const onCopy = vi.fn();
    const onModeChange = vi.fn();

    render(
      <ToastProvider>
        <TagSnippetBlock
          snippets={{
            raw_html: '<div>HTML tag</div>',
            ttd_javascript: 'console.log("tag");',
          }}
          onCopy={onCopy}
          onModeChange={onModeChange}
        />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'TTD JS' }));
    expect(onModeChange).toHaveBeenCalledWith('ttd_javascript');

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('console.log("tag");'));
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith('ttd_javascript'));

    fireEvent.click(screen.getByRole('button', { name: /open raw/i }));
    expect(openWindow).toHaveBeenCalled();
  });

  it('shows an error toast when snippet copy fails', async () => {
    writeText.mockRejectedValueOnce(new Error('clipboard unavailable'));

    render(
      <ToastProvider>
        <TagSnippetBlock
          snippets={{
            raw_html: '<div>HTML tag</div>',
          }}
        />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(await screen.findByText(/couldn’t copy raw html/i)).toBeTruthy();
  });

  it('audits required and optional macros and shows resolved preview', () => {
    render(
      <MacroResolver
        tag={'<a href="%%CLICK_URL_UNESC%%%%DEST_URL%%">${CACHE_BUSTER}[UNSUPPORTED_TOKEN]</a>'}
        spec={{
          dsp: 'generic',
          required: ['CLICK_URL_UNESC', 'DEST_URL', 'MISSING_MACRO'],
          optional: ['CACHE_BUSTER'],
          descriptions: {
            CLICK_URL_UNESC: 'Click macro',
            DEST_URL: 'Destination URL',
            MISSING_MACRO: 'Missing by design',
          },
        }}
        mockValues={{
          CLICK_URL_UNESC: 'https://click.example/',
          DEST_URL: 'https://landing.example/',
          CACHE_BUSTER: '12345',
        }}
      />,
    );

    expect(screen.getAllByText('Required present').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Required missing')).toBeTruthy();
    expect(screen.getByText('Unsupported present')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Resolved preview' }));
    expect(screen.getByText(/https:\/\/click\.example\//i)).toBeTruthy();
    expect(screen.getByText(/12345/)).toBeTruthy();
  });

  it('renders loading and remediation states for diagnostics', () => {
    const onFix = vi.fn();
    const { rerender } = render(
      <TagDiagnostics checks={[]} loading />,
    );

    expect(screen.getByText(/running diagnostics/i)).toBeTruthy();

    rerender(
      <TagDiagnostics
        checks={[
          {
            id: 'fix-click-url',
            label: 'Destination URL configured',
            status: 'warning',
            message: 'Fallback URL missing from one export mode.',
            action: { label: 'Fix now', onClick: onFix },
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fix now' }));
    expect(onFix).toHaveBeenCalled();
  });
});
