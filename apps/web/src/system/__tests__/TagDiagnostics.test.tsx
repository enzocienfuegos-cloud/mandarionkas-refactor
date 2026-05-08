import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { TagDiagnostics } from '../preview/TagDiagnostics';

describe('TagDiagnostics', () => {
  it('renders distinct color classes per status', () => {
    const { container } = render(
      <TagDiagnostics checks={[
        { id: '1', label: 'OK', status: 'ok' },
        { id: '2', label: 'Warn', status: 'warning' },
        { id: '3', label: 'Error', status: 'error' },
        { id: '4', label: 'Info', status: 'info' },
      ]}
      />,
    );

    const icons = Array.from(container.querySelectorAll('svg'));
    const colors = icons.map((svg) => svg.getAttribute('class') ?? '');
    expect(new Set(colors).size).toBe(4);
  });
});
