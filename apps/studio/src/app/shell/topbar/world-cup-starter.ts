import { createInitialState } from '../../../domain/document/factories';
import type { ActionNode, SceneNode, StudioState, WidgetNode, WidgetType } from '../../../domain/document/types';
import { registerBuiltins } from '../../../widgets/registry/register-builtins';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';
import { registerProjectStarter, registerProjectStarterHandler } from './project-starters';

type StarterOptions = {
  name: string;
  clientId?: string;
  clientName?: string;
  brandName?: string;
  campaignName?: string;
};

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
  tokens: [
    { id: 'buenachos', label: 'Buenachos', accent: '#ff7a59', secondary: '#65431f' },
    { id: 'gustitos', label: 'Gustitos', accent: '#2ce6ff', secondary: '#17405a' },
    { id: 'quesitrix', label: 'Quesitrix', accent: '#ffd54a', secondary: '#7a2d12' },
  ],
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

let worldCupStarterRegistered = false;

export function ensureWorldCupStarterRegistered(): void {
  if (worldCupStarterRegistered) return;
  registerProjectStarter({
    id: 'bocadeli-worldcup',
    label: 'Bocadeli World Cup starter',
    description: 'Seeds the World Cup interactive layout with configurable game widgets on 320×480.',
    canvasPresetId: 'interstitial',
  });
  registerProjectStarterHandler('bocadeli-worldcup', createWorldCupStarterState);
  worldCupStarterRegistered = true;
}

function buildTokenImage(label: string, accent: string, secondary: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="156" height="180" viewBox="0 0 156 180">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${secondary}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect x="16" y="12" width="124" height="156" rx="22" fill="url(#bg)" />
      <rect x="24" y="20" width="108" height="140" rx="18" fill="rgba(8,15,28,.26)" stroke="rgba(255,255,255,.28)" stroke-width="2" />
      <circle cx="78" cy="58" r="16" fill="rgba(255,255,255,.92)" />
      <rect x="40" y="90" width="76" height="12" rx="6" fill="rgba(255,255,255,.96)" />
      <rect x="48" y="110" width="60" height="10" rx="5" fill="rgba(255,255,255,.76)" />
      <rect x="34" y="130" width="88" height="18" rx="9" fill="rgba(8,15,28,.34)" />
      <text x="78" y="143" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#ffffff">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

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

function getTokenConfig(config: WorldCupStarterConfig, tokenId: string): WorldCupTokenConfig {
  return config.tokens.find((token) => token.id === tokenId) ?? config.tokens[0];
}

function getTokenAsset(token: WorldCupTokenConfig) {
  return {
    id: token.id,
    label: token.label,
    accentColor: token.accent,
    src: token.tokenSrc ?? buildTokenImage(token.label, token.accent, token.secondary),
  };
}

function createGameStepScene(
  sceneId: string,
  step: WorldCupStepConfig,
  order: number,
  config: WorldCupStarterConfig,
  tokenPoolJson: string,
  nextSceneId: string,
  matchActionId: string,
): { scene: SceneNode; widgets: WidgetNode[] } {
  const heroToken = getTokenAsset(getTokenConfig(config, step.heroTokenId));
  const expectedToken = getTokenConfig(config, step.expectedTokenId);
  const scene: SceneNode = {
    id: sceneId,
    name: step.sceneName,
    order,
    widgetIds: [],
    durationMs: step.durationMs,
    flow: { nextSceneId },
    transition: config.transition ? { ...config.transition } : undefined,
  };

  const widgets = [
    seedWidget('shape', scene.id, 0, {
      name: 'Backdrop',
      frame: { x: 0, y: 0, width: 320, height: 480, rotation: 0 },
      style: { backgroundColor: config.backgroundColor },
      props: { shape: 'rectangle' },
    }),
    seedWidget('shape', scene.id, 1, {
      name: 'Top Glow',
      frame: config.layout.topGlow,
      style: { backgroundColor: '#123e79', opacity: 0.35 },
      props: { shape: 'circle' },
    }),
    seedWidget('text', scene.id, 2, {
      name: 'Headline',
      frame: config.layout.headline,
      props: { text: step.headline },
      style: { color: '#ffffff', fontSize: 24, fontWeight: 800, textAlign: 'center', lineHeight: 1.1 },
    }),
    seedWidget('text', scene.id, 3, {
      name: 'Subhead',
      frame: config.layout.subhead,
      props: { text: step.subhead },
      style: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500, textAlign: 'center', lineHeight: 1.3 },
    }),
    seedWidget('step-indicator', scene.id, 4, {
      name: 'Steps',
      frame: config.layout.steps,
      props: {
        total: config.steps.length,
        current: order,
        size: 10,
        gap: 10,
        doneColor: expectedToken.accent,
        pendingColor: 'rgba(255,255,255,0.25)',
      },
    }),
    seedWidget('particle-halo', scene.id, 5, {
      name: 'Halo',
      frame: config.layout.halo,
      props: {
        size: config.halo.size,
        radius: config.halo.radius,
        count: config.halo.count,
        colorA: config.halo.colorA,
        colorB: expectedToken.accent,
        pulseMs: config.halo.pulseMs,
      },
    }),
    seedWidget('image', scene.id, 6, {
      name: 'Hero Card',
      frame: config.layout.hero,
      props: { src: heroToken.src, alt: heroToken.label },
      style: { backgroundColor: '#1c2b44', fit: 'cover', borderRadius: 24 },
    }),
    seedWidget('drop-zone', scene.id, 7, {
      name: 'Goal Zone',
      frame: config.layout.dropZone,
      props: {
        width: config.dropZone.width,
        height: config.dropZone.height,
        hitPadding: config.dropZone.hitPadding,
        debugOutline: config.dropZone.debugOutline,
        matchActionMap: JSON.stringify({ [step.expectedTokenId]: matchActionId }),
      },
      style: { accentColor: expectedToken.accent },
    }),
    seedWidget('text', scene.id, 8, {
      name: 'Question',
      frame: config.layout.question,
      props: { text: step.question },
      style: { color: '#ffffff', fontSize: 16, fontWeight: 700, textAlign: 'center', lineHeight: 1.25 },
    }),
    seedWidget('timer-bar', scene.id, 9, {
      name: 'Timer',
      frame: config.layout.timer,
      props: { durationMs: step.durationMs, thickness: 10, borderRadius: 999, fillColor: expectedToken.accent, trackColor: 'rgba(255,255,255,0.15)' },
    }),
    seedWidget('drag-token-pool', scene.id, 10, {
      name: 'Token Pool',
      frame: config.layout.tokenPool,
      props: {
        tokenSize: config.tokenPool.tokenSize,
        gap: config.tokenPool.gap,
        tokens: tokenPoolJson,
      },
    }),
    seedWidget('text', scene.id, 11, {
      name: 'Hint',
      frame: config.layout.hint,
      props: { text: step.hint },
      style: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: 500, textAlign: 'center' },
    }),
  ];

  scene.widgetIds = widgets.map((widget) => widget.id);
  return { scene, widgets };
}

function createEndCardScene(
  sceneId: string,
  order: number,
  config: WorldCupStarterConfig,
  replayActionId: string,
): { scene: SceneNode; widgets: WidgetNode[]; ctaWidgetId: string } {
  const token = getTokenAsset(getTokenConfig(config, config.endCard.tokenId));
  const accent = getTokenConfig(config, config.endCard.tokenId).accent;
  const scene: SceneNode = {
    id: sceneId,
    name: config.endCard.sceneName,
    order,
    widgetIds: [],
    durationMs: config.endCard.durationMs,
    flow: undefined,
    transition: config.transition ? { ...config.transition } : undefined,
  };

  const widgets = [
    seedWidget('shape', scene.id, 0, {
      name: 'Backdrop',
      frame: { x: 0, y: 0, width: 320, height: 480, rotation: 0 },
      style: { backgroundColor: config.backgroundColor },
      props: { shape: 'rectangle' },
    }),
    seedWidget('particle-halo', scene.id, 1, {
      name: 'Halo',
      frame: config.layout.endCardHalo,
      props: {
        size: config.endCardHalo.size,
        radius: config.endCardHalo.radius,
        count: config.endCardHalo.count,
        colorA: config.endCardHalo.colorA,
        colorB: accent,
        pulseMs: config.endCardHalo.pulseMs,
      },
    }),
    seedWidget('shape', scene.id, 2, {
      name: 'Pack Plate',
      frame: config.layout.endCardPlate,
      style: { backgroundColor: '#14233e' },
      props: { shape: 'circle' },
    }),
    seedWidget('image', scene.id, 3, {
      name: 'Pack Token',
      frame: config.layout.endCardToken,
      props: { src: token.src, alt: token.label },
      style: { backgroundColor: 'transparent', fit: 'cover', borderRadius: 18 },
    }),
    seedWidget('text', scene.id, 4, {
      name: 'Headline',
      frame: config.layout.endCardHeadline,
      props: { text: config.endCard.headline },
      style: { color: '#ffffff', fontSize: 24, fontWeight: 800, textAlign: 'center', lineHeight: 1.1 },
    }),
    seedWidget('text', scene.id, 5, {
      name: 'Copy',
      frame: config.layout.endCardCopy,
      props: { text: config.endCard.copy },
      style: { color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: 500, textAlign: 'center', lineHeight: 1.35 },
    }),
    seedWidget('cta', scene.id, 6, {
      name: 'CTA',
      frame: config.layout.endCardCta,
      props: { text: config.endCard.buttonLabel, url: '' },
      style: { color: '#10161c', backgroundColor: accent, fontSize: 20, fontWeight: 800 },
    }),
  ];

  scene.widgetIds = widgets.map((widget) => widget.id);
  return {
    scene,
    widgets,
    ctaWidgetId: widgets[widgets.length - 1]?.id ?? replayActionId,
  };
}

export function createWorldCupStarterState(options: StarterOptions, config: WorldCupStarterConfig = DEFAULT_BOCADELI_WORLD_CUP_CONFIG): StudioState {
  const base = createInitialState({
    name: options.name,
    canvasPresetId: config.canvasPresetId,
    backgroundColor: config.backgroundColor,
  });

  const tokenPoolJson = JSON.stringify(config.tokens.map((token) => getTokenAsset(token)));
  const endCardSceneId = `${base.document.scenes[0].id}_end-card`;
  const firstGameSceneId = `${base.document.scenes[0].id}_${config.steps[0]?.id ?? 'step-1'}`;
  const actions: Record<string, ActionNode> = {};

  const endCardSeed = createEndCardScene(endCardSceneId, config.steps.length + 1, config, 'act_worldcup_replay');
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
    const seed = createGameStepScene(sceneId, step, index + 1, config, tokenPoolJson, timeoutSceneId, actionId);
    const dropZoneWidgetId = seed.widgets.find((widget) => widget.type === 'drop-zone')?.id ?? '';
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

  const nextState: StudioState = {
    ...base,
    document: {
      ...base.document,
      name: options.name,
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
    },
  };

  return applyProjectPlatformMeta(nextState, options);
}
