import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from '../primitives/Avatar';

describe('Avatar', () => {
  it('renders initials from a full name', () => {
    render(<Avatar name="Verga López" />);
    expect(screen.getByLabelText('Verga López').textContent).toContain('VL');
  });

  it('keeps the same hashed tone for the same name', () => {
    const { rerender } = render(<Avatar name="Juan Carlos" />);
    const first = screen.getByLabelText('Juan Carlos').className;
    rerender(<Avatar name="Juan Carlos" />);
    expect(screen.getByLabelText('Juan Carlos').className).toBe(first);
  });

  it('applies size variants', () => {
    render(<Avatar name="María A." size="lg" />);
    expect(screen.getByLabelText('María A.').className).toContain('h-16');
  });

  it('renders an image when src is provided', () => {
    render(<Avatar name="Diego R." src="https://example.com/avatar.png" />);
    expect(screen.getByAltText('Diego R.').getAttribute('src')).toBe('https://example.com/avatar.png');
  });
});
