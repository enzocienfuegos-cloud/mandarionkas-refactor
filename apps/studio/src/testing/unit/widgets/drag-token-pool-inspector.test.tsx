/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DragTokenPoolInspector } from '../../../widgets/modules/drag-token-pool.inspector';
import type { WidgetNode } from '../../../domain/document/types';

const updateWidgetProps = vi.fn();

vi.mock('../../../hooks/use-studio-actions', () => ({
  useWidgetActions: () => ({ updateWidgetProps }),
}));

vi.mock('../../../platform/runtime', () => ({
  usePlatformSnapshot: () => ({ session: { isAuthenticated: false, sessionId: '' } }),
}));

vi.mock('../../../shared/ui/AssetPickerButton', () => ({
  AssetPickerButton: ({ label }: { label: string }) => <div data-testid="asset-picker">{label}</div>,
}));

function createNode(overrides: Partial<WidgetNode['props']> = {}): WidgetNode {
  return {
    id: 'pool_1',
    type: 'drag-token-pool',
    name: 'Token Pool',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 280, height: 96, rotation: 0 },
    props: {
      tokens: [],
      disabledIds: [],
      dropTargetId: '',
      tokenSize: 72,
      gap: 16,
      tokenShape: 'circle',
      ...overrides,
    },
    style: {},
    timeline: { startMs: 0, endMs: 15000 },
  };
}

describe('DragTokenPoolInspector', () => {
  beforeEach(() => {
    updateWidgetProps.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('starts with zero tokens and add button enabled', () => {
    const { getByRole } = render(<DragTokenPoolInspector node={createNode()} />);
    expect(screen.getByText('Tokens (0/12)')).toBeTruthy();
    expect((getByRole('button', { name: 'Add token' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('adds tokens via the add button', () => {
    render(<DragTokenPoolInspector node={createNode({
      tokens: [
        { id: 'tok_1', label: 'Token 1' },
        { id: 'tok_2', label: 'Token 2' },
      ],
    })} />);
    expect(screen.getByText('Tokens (2/12)')).toBeTruthy();
    expect(screen.getAllByText('Token image')).toHaveLength(2);
    expect(screen.getAllByText('Base image')).toHaveLength(2);
  });

  it('does not render a textarea', () => {
    const { container } = render(<DragTokenPoolInspector node={createNode()} />);
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('keeps remove disabled when there is only one token left', () => {
    render(<DragTokenPoolInspector node={createNode({
      tokens: [
        { id: 'tok_1', label: 'Token 1' },
      ],
    })} />);
    expect((screen.getByRole('button', { name: '×' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
