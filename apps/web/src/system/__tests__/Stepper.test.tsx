import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Stepper } from '../primitives/Stepper';

const STEPS = [
  { id: 'campaign', label: 'Campaign', status: 'complete' as const, description: 'Scope the tag' },
  { id: 'creative', label: 'Creative', status: 'current' as const, description: 'Bind the asset' },
  { id: 'qa', label: 'QA', status: 'blocked' as const, description: 'Run diagnostics' },
];

describe('Stepper', () => {
  it('renders vertical connector offsets from the shared dot size', () => {
    const { container } = render(<Stepper steps={STEPS} />);
    const connectors = container.querySelectorAll('span[aria-hidden="true"].absolute.w-px');

    expect(connectors).toHaveLength(2);
    expect((connectors[0] as HTMLElement).style.left).toBe('17.5px');
    expect((connectors[0] as HTMLElement).style.top).toBe('36px');
    expect((connectors[0] as HTMLElement).style.height).toBe('calc(100% - 24px)');
  });

  it('only allows clicks on non-blocked steps', () => {
    const onStepClick = vi.fn();
    render(<Stepper steps={STEPS} onStepClick={onStepClick} />);

    fireEvent.click(screen.getByRole('button', { name: /campaign/i }));
    fireEvent.click(screen.getByRole('button', { name: /creative/i }));

    expect(screen.queryByRole('button', { name: /qa/i })).toBeNull();
    expect(onStepClick).toHaveBeenCalledTimes(2);
    expect(onStepClick).toHaveBeenCalledWith('campaign');
    expect(onStepClick).toHaveBeenCalledWith('creative');
  });
});
