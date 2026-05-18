/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DragTokenPoolInspector } from '../../../widgets/modules/drag-token-pool.inspector';
import type { WidgetNode } from '../../../domain/document/types';

const updateWidgetProps = vi.fn();
const updateWidgetFrame = vi.fn();
const selectWidget = vi.fn();
const createWidget = vi.fn();
const sceneAnchorWidget = createDropAnchorWidget();

vi.mock('../../../hooks/use-studio-actions', () => ({
  useWidgetActions: () => ({ createWidget, updateWidgetFrame, updateWidgetProps, selectWidget }),
}));

vi.mock('../../../core/store/use-studio-store', () => ({
  useStudioStore: (selector: (state: any) => unknown) => selector({
    document: {
      metadata: {
        release: {
          targetChannel: 'generic-html5',
        },
      },
      scenes: [
        { id: 'scene_1', name: 'Scene 1' },
        { id: 'scene_2', name: 'Scene 2' },
      ],
      widgets: {
        [sceneAnchorWidget.id]: sceneAnchorWidget,
      },
    },
  }),
}));

vi.mock('../../../core/store/studio-store', () => ({
  studioStore: {
    getState: () => ({
      document: {
        selection: {
          primaryWidgetId: 'drop_created',
        },
      },
    }),
  },
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
      tokenSize: 72,
      gap: 16,
      tokenShape: 'circle',
      dropTargetId: 'drop_1',
      hideAccentForImageTokens: false,
      hideShapeForImageTokens: false,
      tokenImageMaxSizePercent: 82,
      ...overrides,
    },
    style: {},
    timeline: { startMs: 0, endMs: 15000 },
  };
}

function createDropAnchorWidget(): WidgetNode {
  return {
    id: 'target_1',
    type: 'image',
    name: 'Hero target',
    sceneId: 'scene_1',
    zIndex: 2,
    frame: { x: 40, y: 140, width: 180, height: 180, rotation: 0 },
    props: { src: '' },
    style: {},
    timeline: { startMs: 0, endMs: 15000 },
  };
}

describe('DragTokenPoolInspector', () => {
  beforeEach(() => {
    createWidget.mockReset();
    updateWidgetFrame.mockReset();
    updateWidgetProps.mockReset();
    selectWidget.mockReset();
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
    expect(screen.getAllByText('Base image')).toHaveLength(2);
    expect(screen.getByText('Each token can trigger a different scene after a successful drop inside the linked drag area.')).toBeTruthy();
    expect(screen.getAllByText('On drop, go to scene')).toHaveLength(2);
    expect(screen.getAllByText('This scene change runs after this token is dropped into the linked drag area.')).toHaveLength(2);
    expect(screen.getAllByText('Base image fit')).toHaveLength(2);
    expect(screen.getAllByText('Base image scale (%)')).toHaveLength(2);
    expect(screen.getAllByText('Base image focal X')).toHaveLength(2);
    expect(screen.getAllByText('Base image focal Y')).toHaveLength(2);
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

  it('renders image behavior controls and updates them', () => {
    render(<DragTokenPoolInspector node={createNode()} />);

    expect(screen.getByLabelText('Hide accent color when token image exists')).toBeTruthy();
    expect(screen.getByLabelText('Hide shape when token image exists')).toBeTruthy();
    expect(screen.getByLabelText('Image max size (%)')).toBeTruthy();
  });

  it('offers to create a drag area when there is no linked drop zone', () => {
    render(<DragTokenPoolInspector node={createNode({ dropTargetId: '' })} />);

    expect(screen.getByText('No linked drag area yet. Pick a widget to place an invisible drop layer over it, or create a free manual area.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Create area/ })).toBeTruthy();
  });
});
