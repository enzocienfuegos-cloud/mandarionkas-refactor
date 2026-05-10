import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Input } from '../primitives/Input';

describe('Input', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(),
      },
    });
  });

  it('fires onCopySuccess when the built-in copy action succeeds', async () => {
    const onCopySuccess = vi.fn();
    const writeText = vi.mocked(globalThis.navigator.clipboard.writeText);
    writeText.mockResolvedValue(undefined);

    render(<Input value="snippet" copyable onCopySuccess={onCopySuccess} readOnly />);

    fireEvent.click(screen.getByRole('button', { name: /copy value/i }));

    expect(writeText).toHaveBeenCalledWith('snippet');
    await waitFor(() => expect(onCopySuccess).toHaveBeenCalledTimes(1));
  });

  it('fires onCopyError when the built-in copy action fails', async () => {
    const error = new Error('clipboard unavailable');
    const onCopyError = vi.fn();
    const writeText = vi.mocked(globalThis.navigator.clipboard.writeText);
    writeText.mockRejectedValue(error);

    render(<Input value="snippet" copyable onCopyError={onCopyError} readOnly />);

    fireEvent.click(screen.getByRole('button', { name: /copy value/i }));
    await Promise.resolve();

    expect(onCopyError).toHaveBeenCalledWith(error);
  });
});
