import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NumberInput } from '../primitives/NumberInput';

function StatefulNumberInput(props: React.ComponentProps<typeof NumberInput>) {
  const [value, setValue] = React.useState(props.value);
  return <NumberInput {...props} value={value} onChange={setValue} />;
}

describe('NumberInput', () => {
  it('formats on blur and shows the raw number on focus', () => {
    const onChange = vi.fn();

    render(
      <StatefulNumberInput
        value={12500}
        format="currency"
        currency="USD"
      />,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toContain('$12,500');

    fireEvent.focus(input);
    expect(input.value).toBe('12500');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('handles keyboard stepping with min/max clamping', () => {
    render(
      <StatefulNumberInput
        value={5}
        min={0}
        max={10}
        step={3}
      />,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('8');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('5');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('0');
  });

  it('falls back to zero when emptied and nullable is false', () => {
    const onChange = vi.fn();

    render(
      <NumberInput
        value={42}
        onChange={onChange}
        nullable={false}
      />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input, { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('formats percent values with Intl percent formatting', () => {
    render(
      <StatefulNumberInput
        value={0.42}
        format="percent"
        decimals={0}
      />,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('42%');

    fireEvent.focus(input);
    expect(input.value).toBe('0.42');
  });

  it('parses locale decimal separators', () => {
    const onChange = vi.fn();
    render(<NumberInput value={null} onChange={onChange} format="decimal" locale="es-ES" />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1,5' } });
    fireEvent.blur(input, { target: { value: '1,5' } });

    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });
});
