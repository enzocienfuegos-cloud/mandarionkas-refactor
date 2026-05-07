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
});
