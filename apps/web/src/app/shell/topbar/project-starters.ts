import { createInitialState } from '../../../domain/document/factories';
import type { StudioState, WidgetNode, WidgetType } from '../../../domain/document/types';
import { registerBuiltins } from '../../../widgets/registry/register-builtins';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';

export type ProjectStarterId = 'blank' | 'bocadeli-worldcup';

export type ProjectStarterOption = {
  id: ProjectStarterId;
  label: string;
  description: string;
  canvasPresetId?: string;
};

export const PROJECT_STARTERS: ProjectStarterOption[] = [
  {
    id: 'blank',
    label: 'Blank canvas',
    description: 'Start from a clean project and pick any canvas size.',
  },
  {
    id: 'bocadeli-worldcup',
    label: 'Bocadeli World Cup starter',
    description: 'Seeds the World Cup interactive layout with the new game primitives on 320×480.',
    canvasPresetId: 'interstitial',
  },
];

type StarterOptions = {
  starterId: ProjectStarterId;
  name: string;
  canvasPresetId: string;
  clientId?: string;
  clientName?: string;
  brandName?: string;
  campaignName?: string;
};

type WidgetSeedPatch = Partial<Omit<WidgetNode, 'id' | 'type' | 'sceneId' | 'zIndex'>> & {
  frame?: Partial<WidgetNode['frame']>;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  timeline?: Partial<WidgetNode['timeline']>;
};

function seedWidget(type: WidgetType, sceneId: string, zIndex: number, patch: WidgetSeedPatch): WidgetNode {
  registerBuiltins();
  const base = getWidgetDefinition(type).defaults(sceneId, zIndex);
  return {
    ...base,
    ...patch,
    frame: { ...base.frame, ...(patch.frame ?? {}) },
    props: { ...base.props, ...(patch.props ?? {}) },
    style: { ...base.style, ...(patch.style ?? {}) },
    timeline: { ...base.timeline, ...(patch.timeline ?? {}) },
  };
}

function applyProjectPlatformMeta(state: StudioState, options: StarterOptions): StudioState {
  return {
    ...state,
    document: {
      ...state.document,
      metadata: {
        ...state.document.metadata,
        platform: {
          ...(state.document.metadata.platform ?? {}),
          clientId: options.clientId,
          clientName: options.clientName ?? '',
          brandName: options.brandName ?? '',
          campaignName: options.campaignName ?? '',
        },
      },
    },
  };
}

function createBocadeliWorldCupState(options: StarterOptions): StudioState {
  const base = createInitialState({
    name: options.name,
    canvasPresetId: 'interstitial',
    backgroundColor: '#091226',
  });
  const scene = base.document.scenes[0];
  scene.name = 'World Cup Game';
  scene.durationMs = 15000;

  const widgets = [
    seedWidget('shape', scene.id, 0, {
      name: 'Backdrop',
      frame: { x: 0, y: 0, width: 320, height: 480, rotation: 0 },
      style: { backgroundColor: '#091226' },
      props: { shape: 'rectangle' },
    }),
    seedWidget('shape', scene.id, 1, {
      name: 'Top Glow',
      frame: { x: 36, y: 32, width: 248, height: 248, rotation: 0 },
      style: { backgroundColor: '#123e79', opacity: 0.35 },
      props: { shape: 'circle' },
    }),
    seedWidget('text', scene.id, 2, {
      name: 'Headline',
      frame: { x: 20, y: 28, width: 280, height: 54, rotation: 0 },
      props: { text: 'BocaDeli World Cup Challenge' },
      style: { color: '#ffffff', fontSize: 24, fontWeight: 800, textAlign: 'center', lineHeight: 1.1 },
    }),
    seedWidget('text', scene.id, 3, {
      name: 'Subhead',
      frame: { x: 32, y: 84, width: 256, height: 36, rotation: 0 },
      props: { text: 'Drag the correct token to score before time runs out.' },
      style: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500, textAlign: 'center', lineHeight: 1.3 },
    }),
    seedWidget('step-indicator', scene.id, 4, {
      name: 'Steps',
      frame: { x: 110, y: 128, width: 100, height: 24, rotation: 0 },
      props: { total: 3, current: 1, size: 10, gap: 10, doneColor: '#ffd54a', pendingColor: 'rgba(255,255,255,0.25)' },
    }),
    seedWidget('timer-bar', scene.id, 5, {
      name: 'Timer',
      frame: { x: 48, y: 156, width: 224, height: 12, rotation: 0 },
      props: { durationMs: 7000, thickness: 12, borderRadius: 999, fillColor: '#2ce6ff', trackColor: 'rgba(255,255,255,0.15)' },
    }),
    seedWidget('particle-halo', scene.id, 6, {
      name: 'Halo',
      frame: { x: 80, y: 176, width: 160, height: 160, rotation: 0 },
      props: { size: 160, radius: 60, count: 12, colorA: '#ffffff', colorB: '#2ce6ff', pulseMs: 1800 },
    }),
    seedWidget('drop-zone', scene.id, 7, {
      name: 'Goal Zone',
      frame: { x: 106, y: 202, width: 108, height: 108, rotation: 0 },
      props: { width: 92, height: 92, hitPadding: 16, debugOutline: true },
      style: { accentColor: '#ffd54a' },
    }),
    seedWidget('image', scene.id, 8, {
      name: 'Pack Shot',
      frame: { x: 116, y: 212, width: 88, height: 88, rotation: 0 },
      props: { src: '', alt: 'BocaDeli product pack' },
      style: { backgroundColor: '#1c2b44', fit: 'cover', borderRadius: 20 },
    }),
    seedWidget('text', scene.id, 9, {
      name: 'Question',
      frame: { x: 30, y: 338, width: 260, height: 48, rotation: 0 },
      props: { text: 'Which token completes the BocaDeli move?' },
      style: { color: '#ffffff', fontSize: 16, fontWeight: 700, textAlign: 'center', lineHeight: 1.25 },
    }),
    seedWidget('drag-token-pool', scene.id, 10, {
      name: 'Token Pool',
      frame: { x: 28, y: 388, width: 264, height: 78, rotation: 0 },
      props: {
        tokenSize: 68,
        gap: 14,
        tokens: JSON.stringify([
          { id: 'left', label: 'Left', accentColor: '#ff7a59' },
          { id: 'center', label: 'Goal', accentColor: '#2ce6ff' },
          { id: 'right', label: 'Right', accentColor: '#ffd54a' },
        ]),
      },
    }),
    seedWidget('text', scene.id, 11, {
      name: 'Hint',
      frame: { x: 46, y: 452, width: 228, height: 20, rotation: 0 },
      props: { text: 'Tip: use the highlighted token to score.' },
      style: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: 500, textAlign: 'center' },
    }),
  ];

  scene.widgetIds = widgets.map((widget) => widget.id);

  const nextState: StudioState = {
    ...base,
    document: {
      ...base.document,
      name: options.name,
      canvas: {
        ...base.document.canvas,
        backgroundColor: '#091226',
        presetId: 'interstitial',
      },
      scenes: [scene],
      widgets: Object.fromEntries(widgets.map((widget) => [widget.id, widget])),
      selection: {
        ...base.document.selection,
        activeSceneId: scene.id,
      },
    },
  };

  return applyProjectPlatformMeta(nextState, options);
}

export function createProjectStarterState(options: StarterOptions): StudioState {
  if (options.starterId === 'bocadeli-worldcup') {
    return createBocadeliWorldCupState(options);
  }
  return applyProjectPlatformMeta(
    createInitialState({
      name: options.name,
      canvasPresetId: options.canvasPresetId,
    }),
    options,
  );
}
