import { createInitialState } from '../../../domain/document/factories';
import type { ActionNode, SceneNode, StudioState, WidgetNode, WidgetType } from '../../../domain/document/types';
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
  const gameScene = base.document.scenes[0];
  gameScene.name = 'World Cup Game';
  gameScene.durationMs = 15000;

  const buenachosScene: SceneNode = {
    ...base.document.scenes[0],
    id: `${base.document.scenes[0].id}_buenachos`,
    name: 'End Card — Buenachos',
    order: 1,
    widgetIds: [],
    durationMs: 15000,
  };
  const gustitosScene: SceneNode = {
    ...base.document.scenes[0],
    id: `${base.document.scenes[0].id}_gustitos`,
    name: 'End Card — Gustitos',
    order: 2,
    widgetIds: [],
    durationMs: 15000,
  };
  const quesitrixScene: SceneNode = {
    ...base.document.scenes[0],
    id: `${base.document.scenes[0].id}_quesitrix`,
    name: 'End Card — Quesitrix',
    order: 3,
    widgetIds: [],
    durationMs: 15000,
  };

  const gameWidgets = [
    seedWidget('shape', gameScene.id, 0, {
      name: 'Backdrop',
      frame: { x: 0, y: 0, width: 320, height: 480, rotation: 0 },
      style: { backgroundColor: '#091226' },
      props: { shape: 'rectangle' },
    }),
    seedWidget('shape', gameScene.id, 1, {
      name: 'Top Glow',
      frame: { x: 36, y: 32, width: 248, height: 248, rotation: 0 },
      style: { backgroundColor: '#123e79', opacity: 0.35 },
      props: { shape: 'circle' },
    }),
    seedWidget('text', gameScene.id, 2, {
      name: 'Headline',
      frame: { x: 20, y: 28, width: 280, height: 54, rotation: 0 },
      props: { text: 'BocaDeli World Cup Challenge' },
      style: { color: '#ffffff', fontSize: 24, fontWeight: 800, textAlign: 'center', lineHeight: 1.1 },
    }),
    seedWidget('text', gameScene.id, 3, {
      name: 'Subhead',
      frame: { x: 32, y: 84, width: 256, height: 36, rotation: 0 },
      props: { text: 'Drag the correct token to score before time runs out.' },
      style: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500, textAlign: 'center', lineHeight: 1.3 },
    }),
    seedWidget('step-indicator', gameScene.id, 4, {
      name: 'Steps',
      frame: { x: 110, y: 128, width: 100, height: 24, rotation: 0 },
      props: { total: 3, current: 1, size: 10, gap: 10, doneColor: '#ffd54a', pendingColor: 'rgba(255,255,255,0.25)' },
    }),
    seedWidget('timer-bar', gameScene.id, 5, {
      name: 'Timer',
      frame: { x: 48, y: 156, width: 224, height: 12, rotation: 0 },
      props: { durationMs: 7000, thickness: 12, borderRadius: 999, fillColor: '#2ce6ff', trackColor: 'rgba(255,255,255,0.15)' },
    }),
    seedWidget('particle-halo', gameScene.id, 6, {
      name: 'Halo',
      frame: { x: 80, y: 176, width: 160, height: 160, rotation: 0 },
      props: { size: 160, radius: 60, count: 12, colorA: '#ffffff', colorB: '#2ce6ff', pulseMs: 1800 },
    }),
    seedWidget('drop-zone', gameScene.id, 7, {
      name: 'Goal Zone',
      frame: { x: 106, y: 202, width: 108, height: 108, rotation: 0 },
      props: {
        width: 92,
        height: 92,
        hitPadding: 16,
        debugOutline: true,
        matchActionMap: JSON.stringify({
          buenachos: 'act_worldcup_buenachos',
          gustitos: 'act_worldcup_gustitos',
          quesitrix: 'act_worldcup_quesitrix',
        }),
      },
      style: { accentColor: '#ffd54a' },
    }),
    seedWidget('image', gameScene.id, 8, {
      name: 'Pack Shot',
      frame: { x: 116, y: 212, width: 88, height: 88, rotation: 0 },
      props: { src: '', alt: 'BocaDeli product pack' },
      style: { backgroundColor: '#1c2b44', fit: 'cover', borderRadius: 20 },
    }),
    seedWidget('text', gameScene.id, 9, {
      name: 'Question',
      frame: { x: 30, y: 338, width: 260, height: 48, rotation: 0 },
      props: { text: 'Which token completes the BocaDeli move?' },
      style: { color: '#ffffff', fontSize: 16, fontWeight: 700, textAlign: 'center', lineHeight: 1.25 },
    }),
    seedWidget('drag-token-pool', gameScene.id, 10, {
      name: 'Token Pool',
      frame: { x: 28, y: 388, width: 264, height: 78, rotation: 0 },
      props: {
        tokenSize: 68,
        gap: 14,
        tokens: JSON.stringify([
          { id: 'buenachos', label: 'Buenachos', accentColor: '#ff7a59' },
          { id: 'gustitos', label: 'Gustitos', accentColor: '#2ce6ff' },
          { id: 'quesitrix', label: 'Quesitrix', accentColor: '#ffd54a' },
        ]),
      },
    }),
    seedWidget('text', gameScene.id, 11, {
      name: 'Hint',
      frame: { x: 46, y: 452, width: 228, height: 20, rotation: 0 },
      props: { text: 'Drop any pack into the center target to reveal its end card.' },
      style: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: 500, textAlign: 'center' },
    }),
  ];

  function createEndCardScene(sceneId: string, productName: string, accent: string, copy: string) {
    const widgets = [
      seedWidget('shape', sceneId, 0, {
        name: 'Backdrop',
        frame: { x: 0, y: 0, width: 320, height: 480, rotation: 0 },
        style: { backgroundColor: '#091226' },
        props: { shape: 'rectangle' },
      }),
      seedWidget('particle-halo', sceneId, 1, {
        name: 'Halo',
        frame: { x: 80, y: 72, width: 160, height: 160, rotation: 0 },
        props: { size: 160, radius: 60, count: 12, colorA: '#ffffff', colorB: accent, pulseMs: 1800 },
      }),
      seedWidget('shape', sceneId, 2, {
        name: 'Pack Plate',
        frame: { x: 96, y: 92, width: 128, height: 128, rotation: 0 },
        style: { backgroundColor: '#14233e' },
        props: { shape: 'circle' },
      }),
      seedWidget('text', sceneId, 3, {
        name: 'Headline',
        frame: { x: 24, y: 246, width: 272, height: 42, rotation: 0 },
        props: { text: `${productName} unlocked` },
        style: { color: '#ffffff', fontSize: 24, fontWeight: 800, textAlign: 'center', lineHeight: 1.1 },
      }),
      seedWidget('text', sceneId, 4, {
        name: 'Copy',
        frame: { x: 34, y: 298, width: 252, height: 54, rotation: 0 },
        props: { text: copy },
        style: { color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: 500, textAlign: 'center', lineHeight: 1.35 },
      }),
      seedWidget('cta', sceneId, 5, {
        name: 'CTA',
        frame: { x: 58, y: 372, width: 204, height: 46, rotation: 0 },
        props: { text: 'Play again', url: '' },
        style: { color: '#10161c', backgroundColor: accent, fontSize: 20, fontWeight: 800 },
      }),
    ];
    return widgets;
  }

  const buenachosWidgets = createEndCardScene(buenachosScene.id, 'Buenachos', '#ff7a59', 'Crispy, bold, and match-ready. This one wins the final play.');
  const gustitosWidgets = createEndCardScene(gustitosScene.id, 'Gustitos', '#2ce6ff', 'Bright, playful and snackable. A quick burst of flavor after the drop.');
  const quesitrixWidgets = createEndCardScene(quesitrixScene.id, 'Quesitrix', '#ffd54a', 'Cheesy energy for the closing moment. A bold finish for the end card.');

  gameScene.widgetIds = gameWidgets.map((widget) => widget.id);
  buenachosScene.widgetIds = buenachosWidgets.map((widget) => widget.id);
  gustitosScene.widgetIds = gustitosWidgets.map((widget) => widget.id);
  quesitrixScene.widgetIds = quesitrixWidgets.map((widget) => widget.id);

  const widgets = [...gameWidgets, ...buenachosWidgets, ...gustitosWidgets, ...quesitrixWidgets];
  const actions: Record<string, ActionNode> = {
    act_worldcup_buenachos: {
      id: 'act_worldcup_buenachos',
      widgetId: gameWidgets.find((widget) => widget.type === 'drop-zone')?.id ?? '',
      trigger: 'click',
      type: 'go-to-scene',
      targetSceneId: buenachosScene.id,
      label: 'Drop Buenachos → Scene',
    },
    act_worldcup_gustitos: {
      id: 'act_worldcup_gustitos',
      widgetId: gameWidgets.find((widget) => widget.type === 'drop-zone')?.id ?? '',
      trigger: 'click',
      type: 'go-to-scene',
      targetSceneId: gustitosScene.id,
      label: 'Drop Gustitos → Scene',
    },
    act_worldcup_quesitrix: {
      id: 'act_worldcup_quesitrix',
      widgetId: gameWidgets.find((widget) => widget.type === 'drop-zone')?.id ?? '',
      trigger: 'click',
      type: 'go-to-scene',
      targetSceneId: quesitrixScene.id,
      label: 'Drop Quesitrix → Scene',
    },
  };

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
      scenes: [gameScene, buenachosScene, gustitosScene, quesitrixScene],
      widgets: Object.fromEntries(widgets.map((widget) => [widget.id, widget])),
      actions,
      selection: {
        ...base.document.selection,
        activeSceneId: gameScene.id,
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
