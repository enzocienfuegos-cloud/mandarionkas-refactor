import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Combobox, type ComboboxOption } from '../primitives/Combobox';

const OPTIONS: ComboboxOption[] = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta', description: 'Second item' },
  { value: 'gamma', label: 'Gamma', disabled: true, disabledReason: 'Unavailable' },
];

describe('Combobox', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('supports keyboard navigation from the search input', async () => {
    const onChange = vi.fn();
    const { container } = render(<Combobox options={OPTIONS} value="" onChange={onChange} />);

    fireEvent.click(container.querySelector('[aria-haspopup="listbox"]') as HTMLElement);
    const input = await screen.findByRole('combobox');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('beta');
  });

  it('supports multi-select removal and clear-all', () => {
    const onChange = vi.fn();
    const { container } = render(<Combobox options={OPTIONS} value={['alpha', 'beta']} onChange={onChange} multi />);

    fireEvent.click(screen.getByRole('button', { name: /remove alpha/i }));
    expect(onChange).toHaveBeenCalledWith(['beta']);

    fireEvent.click(container.querySelector('[aria-haspopup="listbox"]') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
