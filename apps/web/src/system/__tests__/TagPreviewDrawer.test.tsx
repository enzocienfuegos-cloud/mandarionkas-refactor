import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../feedback/Toast';
import { TagPreviewDrawer } from '../preview/TagPreviewDrawer';

const writeText = vi.fn();

Object.assign(navigator, {
  clipboard: {
    writeText,
  },
});

describe('TagPreviewDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a display preview, copies the public url and closes', async () => {
    const onClose = vi.fn();
    render(
      <ToastProvider>
        <TagPreviewDrawer
          open
          onClose={onClose}
          tag={{
            id: 'tag-1',
            name: 'Homepage Billboard',
            format: 'display',
            status: 'active',
            publicUrl: 'https://cdn.example.com/tag-1.html',
            clickUrl: 'https://advertiser.example.com',
            width: 300,
            height: 250,
            updatedAt: '2026-05-07T18:00:00.000Z',
            diagnosticStatus: 'ok',
            activeBindingsCount: 2,
          }}
        />
      </ToastProvider>,
    );

    const frame = screen.getByTitle('Homepage Billboard preview');
    expect(frame.getAttribute('src')).toBe('https://cdn.example.com/tag-1.html');

    fireEvent.click(screen.getByRole('button', { name: /copy public url/i }));
    expect(writeText).toHaveBeenCalledWith('https://cdn.example.com/tag-1.html');

    fireEvent.click(screen.getAllByRole('button', { name: /close/i })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders snippet, macros and diagnostics tabs when enriched preview data is available', () => {
    render(
      <ToastProvider>
        <TagPreviewDrawer
          open
          onClose={vi.fn()}
          tag={{
            id: 'tag-2',
            name: 'Basis Display',
            format: 'display',
            status: 'active',
            publicUrl: 'https://cdn.example.com/tag-2.html',
            clickUrl: 'https://advertiser.example.com',
            width: 300,
            height: 250,
            diagnosticStatus: 'warning',
            diagnosticMessage: 'Fallback possible',
          }}
          snippets={{
            'display-js': '<script src="https://cdn.example.com/tag-2.js"></script>',
            'display-iframe': '<iframe src="https://cdn.example.com/tag-2.html"></iframe>',
          }}
          macroSpec={{
            dsp: 'Basis',
            required: ['{clickMacroEnc}'],
            optional: ['{gdpr}'],
            descriptions: {
              '{clickMacroEnc}': 'Click macro',
              '{gdpr}': 'GDPR flag',
            },
          }}
          diagnosticChecks={[
            {
              id: 'delivery-mode',
              label: 'Delivery Mode',
              status: 'warning',
              message: 'Effective mode: Basis Native.',
            },
          ]}
        />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Snippet' }));
    expect(screen.getByText('Display JS')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Macros' }));
    expect(screen.getByText('{clickMacroEnc}')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Diagnostics' }));
    expect(screen.getByText('Delivery Mode')).toBeTruthy();
    expect(screen.getByText('Effective mode: Basis Native.')).toBeTruthy();
  });

  it('shows the macros tab when snippet data exists even without a public url', () => {
    render(
      <ToastProvider>
        <TagPreviewDrawer
          open
          onClose={vi.fn()}
          tag={{
            id: 'tag-3',
            name: 'Draft Display',
            format: 'display',
            status: 'draft',
            publicUrl: null,
            clickUrl: null,
            diagnosticStatus: 'warning',
          }}
          snippets={{
            raw_html: '<script>window.tag="${CLICK_URL_ESC}"</script>',
          }}
          macroSpec={{
            dsp: 'Adform',
            required: ['${CLICK_URL_ESC}'],
            optional: [],
          }}
          diagnosticChecks={[
            {
              id: 'draft',
              label: 'Draft status',
              status: 'warning',
              message: 'Publish pending.',
            },
          ]}
        />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Macros' }));
    expect(screen.getByText('${CLICK_URL_ESC}')).toBeTruthy();
  });
});
