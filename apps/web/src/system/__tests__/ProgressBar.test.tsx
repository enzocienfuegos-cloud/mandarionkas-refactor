import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../primitives/ProgressBar';

describe('ProgressBar', () => {
  it('renders the requested width', () => {
    const { container } = render(<ProgressBar value={75} aria-label="Pacing" />);
    const fill = container.querySelector('.bg-brand-500') as HTMLElement;
    expect(fill.style.width).toBe('75%');
  });

  it('uses critical tone when auto thresholds are crossed', () => {
    const { container } = render(<ProgressBar value={30} tone="auto" aria-label="Pacing" />);
    expect(container.querySelector('.bg-\\[color\\:var\\(--dusk-status-critical-fg\\)\\]')).toBeTruthy();
  });

  it('renders the target indicator', () => {
    const { container } = render(<ProgressBar value={68} target={80} aria-label="Pacing" />);
    expect(container.querySelector('[title="Target 80%"]')).toBeTruthy();
  });

  it('applies the label formatter', () => {
    render(<ProgressBar value={42} format={(value) => `${value.toFixed(1)} pct`} aria-label="Pacing" />);
    expect(screen.getByText('42.0 pct').textContent).toBe('42.0 pct');
  });
});
