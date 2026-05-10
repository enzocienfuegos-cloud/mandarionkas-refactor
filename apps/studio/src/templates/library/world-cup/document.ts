import { createInitialState } from '../../../domain/document/factories';
import { isDropZoneWidgetType } from '../../../domain/document/widget-type-groups';
import type { ActionNode, SceneNode, StudioDocument, WidgetNode, WidgetType } from '../../../domain/document/types';
import type { TemplateBuildOptions } from '../types';
import { createTemplateWidgetSeed } from '../helpers/template-widget-defaults';
import { createEndCardScene, createGameStepScene, getTokenAsset } from './scene-builders';
import { BOCADELI_WORLD_CUP_TOKENS } from './teams';

export type WorldCupTokenConfig = {
  id: string;
  label: string;
  accent: string;
  secondary: string;
  tokenSrc?: string;
};

export type WorldCupStepConfig = {
  id: string;
  sceneName: string;
  expectedTokenId: string;
  heroTokenId: string;
  headline: string;
  subhead: string;
  question: string;
  hint: string;
  durationMs: number;
  successTargetStepId?: string;
  timeoutTargetStepId?: string | 'end-card';
};

export type WorldCupEndCardConfig = {
  sceneName: string;
  durationMs: number;
  tokenId: string;
  headline: string;
  copy: string;
  buttonLabel: string;
};

export type WorldCupStarterConfig = {
  canvasPresetId: string;
  backgroundColor: string;
  timeoutEndCardTokenId: string;
  layout: {
    topGlow: WidgetNode['frame'];
    headline: WidgetNode['frame'];
    subhead: WidgetNode['frame'];
    steps: WidgetNode['frame'];
    timer: WidgetNode['frame'];
    halo: WidgetNode['frame'];
    dropZone: WidgetNode['frame'];
    hero: WidgetNode['frame'];
    question: WidgetNode['frame'];
    tokenPool: WidgetNode['frame'];
    hint: WidgetNode['frame'];
    endCardHalo: WidgetNode['frame'];
    endCardPlate: WidgetNode['frame'];
    endCardToken: WidgetNode['frame'];
    endCardHeadline: WidgetNode['frame'];
    endCardCopy: WidgetNode['frame'];
    endCardCta: WidgetNode['frame'];
  };
  tokenPool: {
    tokenSize: number;
    gap: number;
  };
  dropZone: {
    width: number;
    height: number;
    hitPadding: number;
    debugOutline: boolean;
  };
  halo: {
    size: number;
    radius: number;
    count: number;
    colorA: string;
    colorB: string;
    pulseMs: number;
  };
  endCardHalo: {
    size: number;
    radius: number;
    count: number;
    colorA: string;
    pulseMs: number;
  };
  transition: SceneNode['transition'];
  tokens: WorldCupTokenConfig[];
  steps: WorldCupStepConfig[];
  endCard: WorldCupEndCardConfig;
};

const DEFAULT_LAYOUT: WorldCupStarterConfig['layout'] = {
  topGlow: { x: 36, y: 24, width: 248, height: 248, rotation: 0 },
  headline: { x: 20, y: 24, width: 280, height: 54, rotation: 0 },
  subhead: { x: 32, y: 78, width: 256, height: 34, rotation: 0 },
  steps: { x: 110, y: 122, width: 100, height: 24, rotation: 0 },
  timer: { x: 28, y: 346, width: 264, height: 10, rotation: 0 },
  halo: { x: 72, y: 124, width: 176, height: 176, rotation: 0 },
  dropZone: { x: 100, y: 150, width: 120, height: 120, rotation: 0 },
  hero: { x: 82, y: 120, width: 156, height: 180, rotation: 0 },
  question: { x: 30, y: 310, width: 260, height: 32, rotation: 0 },
  tokenPool: { x: 20, y: 270, width: 280, height: 96, rotation: 0 },
  hint: { x: 34, y: 446, width: 252, height: 20, rotation: 0 },
  endCardHalo: { x: 80, y: 72, width: 160, height: 160, rotation: 0 },
  endCardPlate: { x: 96, y: 92, width: 128, height: 128, rotation: 0 },
  endCardToken: { x: 104, y: 100, width: 112, height: 112, rotation: 0 },
  endCardHeadline: { x: 24, y: 246, width: 272, height: 42, rotation: 0 },
  endCardCopy: { x: 34, y: 298, width: 252, height: 54, rotation: 0 },
  endCardCta: { x: 58, y: 372, width: 204, height: 46, rotation: 0 },
};

export const DEFAULT_BOCADELI_WORLD_CUP_CONFIG: WorldCupStarterConfig = {
  canvasPresetId: 'interstitial',
  backgroundColor: '#091226',
  timeoutEndCardTokenId: 'buenachos',
  layout: DEFAULT_LAYOUT,
  tokenPool: {
    tokenSize: 74,
    gap: 10,
  },
  dropZone: {
    width: 110,
    height: 110,
    hitPadding: 16,
    debugOutline: true,
  },
  halo: {
    size: 160,
    radius: 60,
    count: 12,
    colorA: '#ffffff',
    colorB: '#2ce6ff',
    pulseMs: 1800,
  },
  endCardHalo: {
    size: 160,
    radius: 60,
    count: 12,
    colorA: '#ffffff',
    pulseMs: 1800,
  },
  transition: {
    type: 'fade',
    durationMs: 450,
  },
  tokens: BOCADELI_WORLD_CUP_TOKENS,
  steps: [
    {
      id: 'step-1',
      sceneName: 'World Cup — Step 1',
      expectedTokenId: 'buenachos',
      heroTokenId: 'buenachos',
      headline: 'Elige tu sabor y juega el Mundial',
      subhead: 'Descubre al campeón.',
      question: '¿Qué sabor levanta la copa?',
      hint: 'Arrastra para jugar.',
      durationMs: 7000,
      successTargetStepId: 'step-2',
      timeoutTargetStepId: 'end-card',
    },
    {
      id: 'step-2',
      sceneName: 'World Cup — Step 2',
      expectedTokenId: 'gustitos',
      heroTokenId: 'gustitos',
      headline: 'Sigue avanzando en la cancha',
      subhead: 'Completa la segunda jugada.',
      question: '¿Qué token sigue en la alineación?',
      hint: 'Arrastra el siguiente sabor.',
      durationMs: 7000,
      successTargetStepId: 'step-3',
      timeoutTargetStepId: 'end-card',
    },
    {
      id: 'step-3',
      sceneName: 'World Cup — Step 3',
      expectedTokenId: 'quesitrix',
      heroTokenId: 'quesitrix',
      headline: 'Última jugada del desafío',
      subhead: 'Cierra el flujo con el sabor correcto.',
      question: '¿Qué sabor completa la final?',
      hint: 'Un arrastre más para desbloquear la end card.',
      durationMs: 7000,
      successTargetStepId: 'end-card',
      timeoutTargetStepId: 'end-card',
    },
  ],
  endCard: {
    sceneName: 'World Cup — End Card',
    durationMs: 15000,
    tokenId: 'quesitrix',
    headline: 'Quesitrix unlocked',
    copy: 'Cheesy energy for the closing moment. A bold finish for the end card.',
    buttonLabel: 'Play again',
  },
};

type WidgetSeedPatch = Partial<Omit<WidgetNode, 'id' | 'type' | 'sceneId' | 'zIndex'>> & {
  frame?: Partial<WidgetNode['frame']>;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  timeline?: Partial<WidgetNode['timeline']>;
};

function seedWidget(type: WidgetType, sceneId: string, zIndex: number, patch: WidgetSeedPatch): WidgetNode {
  const base = createTemplateWidgetSeed(type, sceneId, zIndex);
  return {
    ...base,
    ...patch,
    frame: { ...base.frame, ...(patch.frame ?? {}) },
    props: { ...base.props, ...(patch.props ?? {}) },
    style: { ...base.style, ...(patch.style ?? {}) },
    timeline: { ...base.timeline, ...(patch.timeline ?? {}) },
  };
}

export function buildWorldCupTemplateDocument(
  options: TemplateBuildOptions = {},
  config: WorldCupStarterConfig = DEFAULT_BOCADELI_WORLD_CUP_CONFIG,
): StudioDocument {
  const base = createInitialState({
    name: options.name,
    canvasPresetId: config.canvasPresetId,
    backgroundColor: config.backgroundColor,
  });

  const tokenPoolJson = JSON.stringify(config.tokens.map((token) => getTokenAsset(token)));
  const endCardSceneId = `${base.document.scenes[0].id}_end-card`;
  const firstGameSceneId = `${base.document.scenes[0].id}_${config.steps[0]?.id ?? 'step-1'}`;
  const actions: Record<string, ActionNode> = {};

  const endCardSeed = createEndCardScene(seedWidget, endCardSceneId, config.steps.length + 1, config, 'act_worldcup_replay');
  actions.act_worldcup_replay = {
    id: 'act_worldcup_replay',
    widgetId: endCardSeed.ctaWidgetId,
    trigger: 'click',
    type: 'go-to-scene',
    targetSceneId: firstGameSceneId,
    label: 'World Cup replay',
  };

  function resolveStepSceneId(stepId?: string | 'end-card'): string {
    if (!stepId || stepId === 'end-card') return endCardSeed.scene.id;
    return `${base.document.scenes[0].id}_${stepId}`;
  }

  const stepSeeds = config.steps.map((step, index) => {
    const sceneId = `${base.document.scenes[0].id}_${step.id}`;
    const defaultSuccessTargetStepId = index === config.steps.length - 1 ? 'end-card' : config.steps[index + 1].id;
    const successSceneId = resolveStepSceneId(step.successTargetStepId ?? defaultSuccessTargetStepId);
    const timeoutSceneId = resolveStepSceneId(step.timeoutTargetStepId ?? 'end-card');
    const actionId = `act_worldcup_step_${step.id}`;
    const seed = createGameStepScene(seedWidget, sceneId, step, index + 1, config, tokenPoolJson, timeoutSceneId, actionId);
    const dropZoneWidgetId = seed.widgets.find((widget) => isDropZoneWidgetType(widget.type))?.id ?? '';
    actions[actionId] = {
      id: actionId,
      widgetId: dropZoneWidgetId,
      trigger: 'click',
      type: 'go-to-scene',
      targetSceneId: successSceneId,
      label: `Complete ${step.sceneName}`,
    };
    return seed;
  });

  const scenes = [...stepSeeds.map((seed) => seed.scene), endCardSeed.scene];
  const widgets = [...stepSeeds.flatMap((seed) => seed.widgets), ...endCardSeed.widgets];

  return {
    ...base.document,
    name: options.name?.trim() || base.document.name,
    canvas: {
      ...base.document.canvas,
      backgroundColor: config.backgroundColor,
      presetId: config.canvasPresetId,
    },
    scenes,
    widgets: Object.fromEntries(widgets.map((widget) => [widget.id, widget])),
    actions,
    selection: {
      ...base.document.selection,
      activeSceneId: firstGameSceneId,
    },
  };
}
