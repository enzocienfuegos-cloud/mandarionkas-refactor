import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FilterBar } from '../primitives/FilterBar';

describe('FilterBar', () => {
  it('clear button does not propagate to the toggle action', () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        pills={[{
          id: 'status',
          label: 'Status',
          value: 'active',
          options: [
            { value: '', label: 'All' },
            { value: 'active', label: 'Active' },
          ],
          onChange,
        }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /clear status/i }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
