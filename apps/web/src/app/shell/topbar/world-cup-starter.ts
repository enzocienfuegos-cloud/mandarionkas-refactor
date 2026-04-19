import { createInitialState } from '../../../domain/document/factories';
import type { ActionNode, SceneNode, StudioState, WidgetNode, WidgetType } from '../../../domain/document/types';
import { registerBuiltins } from '../../../widgets/registry/register-builtins';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';

type StarterOptions = {
  name: string;
  clientId?: string;
  clientName?: string;
  brandName?: string;
  campaignName?: string;
};

export type WorldCupProductConfig = {
  id: string;
  label: string;
  accent: string;
  secondary: string;
  unlockedTitle: string;
  unlockedCopy: string;
  tokenSrc?: string;
};

export type WorldCupStarterConfig = {
  canvasPresetId: string;
  backgroundColor: string;
  gameSceneName: string;
  gameDurationMs: number;
  endCardDurationMs: number;
  timeoutTargetProductId: string;
  replayLabel: string;
  headline: string;
  subhead: string;
  question: string;
  hint: string;
  heroAlt: string;
  heroTokenId: string;
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
  products: WorldCupProductConfig[];
};

const DEFAULT_LAYOUT: WorldCupStarterConfig['layout'] = {
  topGlow: { x: 36, y: 32, width: 248, height: 248, rotation: 0 },
  headline: { x: 20, y: 28, width: 280, height: 54, rotation: 0 },
  subhead: { x: 32, y: 84, width: 256, height: 36, rotation: 0 },
  steps: { x: 110, y: 128, width: 100, height: 24, rotation: 0 },
  timer: { x: 48, y: 156, width: 224, height: 12, rotation: 0 },
  halo: { x: 72, y: 154, width: 176, height: 176, rotation: 0 },
  dropZone: { x: 100, y: 180, width: 120, height: 120, rotation: 0 },
  hero: { x: 104, y: 184, width: 112, height: 112, rotation: 0 },
  question: { x: 30, y: 308, width: 260, height: 48, rotation: 0 },
  tokenPool: { x: 20, y: 330, width: 280, height: 110, rotation: 0 },
  hint: { x: 34, y: 454, width: 252, height: 20, rotation: 0 },
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
  gameSceneName: 'World Cup Game',
  gameDurationMs: 7000,
  endCardDurationMs: 15000,
  timeoutTargetProductId: 'buenachos',
  replayLabel: 'Play again',
  headline: 'BocaDeli World Cup Challenge',
  subhead: 'Drag the correct token to score before time runs out.',
  question: 'Which token completes the BocaDeli move?',
  hint: 'Drop any pack into the center target to reveal its end card.',
  heroAlt: 'BocaDeli product pack',
  heroTokenId: 'buenachos',
  layout: DEFAULT_LAYOUT,
  tokenPool: {
    tokenSize: 74,
    gap: 10,
  },
  dropZone: {
    width: 104,
    height: 104,
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
  products: [
    {
      id: 'buenachos',
      label: 'Buenachos',
      accent: '#ff7a59',
      secondary: '#65431f',
      unlockedTitle: 'Buenachos unlocked',
      unlockedCopy: 'Crispy, bold, and match-ready. This one wins the final play.',
    },
    {
      id: 'gustitos',
      label: 'Gustitos',
      accent: '#2ce6ff',
      secondary: '#17405a',
      unlockedTitle: 'Gustitos unlocked',
      unlockedCopy: 'Bright, playful and snackable. A quick burst of flavor after the drop.',
    },
    {
      id: 'quesitrix',
      label: 'Quesitrix',
      accent: '#ffd54a',
      secondary: '#7a2d12',
      unlockedTitle: 'Quesitrix unlocked',
      unlockedCopy: 'Cheesy energy for the closing moment. A bold finish for the end card.',
    },
  ],
};

function buildTokenImage(label: string, accent: string, secondary: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${secondary}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect x="8" y="6" width="112" height="116" rx="18" fill="url(#bg)" />
      <rect x="16" y="14" width="96" height="100" rx="14" fill="rgba(8,15,28,.28)" stroke="rgba(255,255,255,.35)" stroke-width="2" />
      <circle cx="64" cy="38" r="14" fill="rgba(255,255,255,.92)" />
      <rect x="27" y="60" width="74" height="10" rx="5" fill="rgba(255,255,255,.96)" />
      <rect x="34" y="76" width="60" height="9" rx="4.5" fill="rgba(255,255,255,.72)" />
      <rect x="28" y="92" width="72" height="14" rx="7" fill="rgba(8,15,28,.36)" />
      <text x="64" y="102" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff">${label}</text>
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

function getProductToken(product: WorldCupProductConfig) {
  return {
    id: product.id,
    label: product.label,
    accentColor: product.accent,
    src: product.tokenSrc ?? buildTokenImage(product.label, product.accent, product.secondary),
  };
}

function createEndCardScene(
  baseScene: SceneNode,
  order: number,
  product: WorldCupProductConfig,
  config: WorldCupStarterConfig,
  replayActionId: string,
): { scene: SceneNode; widgets: WidgetNode[]; ctaWidgetId: string } {
  const sceneId = `${baseScene.id}_${product.id}`;
  const scene: SceneNode = {
    ...baseScene,
    id: sceneId,
    name: `End Card — ${product.label}`,
    order,
    widgetIds: [],
    durationMs: config.endCardDurationMs,
    flow: undefined,
    transition: config.transition ? { ...config.transition } : undefined,
  };
  const token = getProductToken(product);
  const widgets = [
    seedWidget('shape', sceneId, 0, {
      name: 'Backdrop',
      frame: { x: 0, y: 0, width: 320, height: 480, rotation: 0 },
      style: { backgroundColor: config.backgroundColor },
      props: { shape: 'rectangle' },
    }),
    seedWidget('particle-halo', sceneId, 1, {
      name: 'Halo',
      frame: config.layout.endCardHalo,
      props: {
        size: config.endCardHalo.size,
        radius: config.endCardHalo.radius,
        count: config.endCardHalo.count,
        colorA: config.endCardHalo.colorA,
        colorB: product.accent,
        pulseMs: config.endCardHalo.pulseMs,
      },
    }),
    seedWidget('shape', sceneId, 2, {
      name: 'Pack Plate',
      frame: config.layout.endCardPlate,
      style: { backgroundColor: '#14233e' },
      props: { shape: 'circle' },
    }),
    seedWidget('image', sceneId, 3, {
      name: 'Pack Token',
      frame: config.layout.endCardToken,
      props: { src: token.src, alt: `${product.label} token` },
      style: { backgroundColor: 'transparent', fit: 'cover', borderRadius: 18 },
    }),
    seedWidget('text', sceneId, 4, {
      name: 'Headline',
      frame: config.layout.endCardHeadline,
      props: { text: product.unlockedTitle },
      style: { color: '#ffffff', fontSize: 24, fontWeight: 800, textAlign: 'center', lineHeight: 1.1 },
    }),
    seedWidget('text', sceneId, 5, {
      name: 'Copy',
      frame: config.layout.endCardCopy,
      props: { text: product.unlockedCopy },
      style: { color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: 500, textAlign: 'center', lineHeight: 1.35 },
    }),
    seedWidget('cta', sceneId, 6, {
      name: 'CTA',
      frame: config.layout.endCardCta,
      props: { text: config.replayLabel, url: '' },
      style: { color: '#10161c', backgroundColor: product.accent, fontSize: 20, fontWeight: 800 },
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
  const gameScene = {
    ...base.document.scenes[0],
    name: config.gameSceneName,
    durationMs: config.gameDurationMs,
    transition: config.transition ? { ...config.transition } : undefined,
  };

  const timeoutProduct = config.products.find((product) => product.id === config.timeoutTargetProductId) ?? config.products[0];
  const heroProduct = config.products.find((product) => product.id === config.heroTokenId) ?? timeoutProduct;
  const heroToken = heroProduct ? getProductToken(heroProduct) : undefined;

  const actions: Record<string, ActionNode> = {};
  const endCardScenes = config.products.map((product, index) => {
    const replayActionId = `act_worldcup_replay_${product.id}`;
    const seeded = createEndCardScene(base.document.scenes[0], index + 1, product, config, replayActionId);
    actions[replayActionId] = {
      id: replayActionId,
      widgetId: seeded.ctaWidgetId,
      trigger: 'click',
      type: 'go-to-scene',
      targetSceneId: gameScene.id,
      label: `${product.label} replay`,
    };
    return seeded;
  });

  const actionMap = Object.fromEntries(
    endCardScenes.map(({ scene }, index) => {
      const product = config.products[index];
      return [
        product.id,
        `act_worldcup_drop_${product.id}`,
      ];
    }),
  );

  endCardScenes.forEach(({ scene }, index) => {
    const product = config.products[index];
    actions[`act_worldcup_drop_${product.id}`] = {
      id: `act_worldcup_drop_${product.id}`,
      widgetId: '',
      trigger: 'click',
      type: 'go-to-scene',
      targetSceneId: scene.id,
      label: `Drop ${product.label} → ${scene.name}`,
    };
  });

  gameScene.flow = timeoutProduct ? { nextSceneId: endCardScenes.find(({ scene }, index) => config.products[index].id === timeoutProduct.id)?.scene.id } : undefined;

  const gameWidgets = [
    seedWidget('shape', gameScene.id, 0, {
      name: 'Backdrop',
      frame: { x: 0, y: 0, width: 320, height: 480, rotation: 0 },
      style: { backgroundColor: config.backgroundColor },
      props: { shape: 'rectangle' },
    }),
    seedWidget('shape', gameScene.id, 1, {
      name: 'Top Glow',
      frame: config.layout.topGlow,
      style: { backgroundColor: '#123e79', opacity: 0.35 },
      props: { shape: 'circle' },
    }),
    seedWidget('text', gameScene.id, 2, {
      name: 'Headline',
      frame: config.layout.headline,
      props: { text: config.headline },
      style: { color: '#ffffff', fontSize: 24, fontWeight: 800, textAlign: 'center', lineHeight: 1.1 },
    }),
    seedWidget('text', gameScene.id, 3, {
      name: 'Subhead',
      frame: config.layout.subhead,
      props: { text: config.subhead },
      style: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500, textAlign: 'center', lineHeight: 1.3 },
    }),
    seedWidget('step-indicator', gameScene.id, 4, {
      name: 'Steps',
      frame: config.layout.steps,
      props: { total: config.products.length, current: 1, size: 10, gap: 10, doneColor: '#ffd54a', pendingColor: 'rgba(255,255,255,0.25)' },
    }),
    seedWidget('timer-bar', gameScene.id, 5, {
      name: 'Timer',
      frame: config.layout.timer,
      props: { durationMs: config.gameDurationMs, thickness: 12, borderRadius: 999, fillColor: '#2ce6ff', trackColor: 'rgba(255,255,255,0.15)' },
    }),
    seedWidget('particle-halo', gameScene.id, 6, {
      name: 'Halo',
      frame: config.layout.halo,
      props: {
        size: config.halo.size,
        radius: config.halo.radius,
        count: config.halo.count,
        colorA: config.halo.colorA,
        colorB: config.halo.colorB,
        pulseMs: config.halo.pulseMs,
      },
    }),
    seedWidget('drop-zone', gameScene.id, 7, {
      name: 'Goal Zone',
      frame: config.layout.dropZone,
      props: {
        width: config.dropZone.width,
        height: config.dropZone.height,
        hitPadding: config.dropZone.hitPadding,
        debugOutline: config.dropZone.debugOutline,
        matchActionMap: JSON.stringify(actionMap),
      },
      style: { accentColor: '#ffd54a' },
    }),
    seedWidget('image', gameScene.id, 8, {
      name: 'Pack Shot',
      frame: config.layout.hero,
      props: { src: heroToken?.src ?? '', alt: config.heroAlt },
      style: { backgroundColor: '#1c2b44', fit: 'cover', borderRadius: 20 },
    }),
    seedWidget('text', gameScene.id, 9, {
      name: 'Question',
      frame: config.layout.question,
      props: { text: config.question },
      style: { color: '#ffffff', fontSize: 16, fontWeight: 700, textAlign: 'center', lineHeight: 1.25 },
    }),
    seedWidget('drag-token-pool', gameScene.id, 10, {
      name: 'Token Pool',
      frame: config.layout.tokenPool,
      props: {
        tokenSize: config.tokenPool.tokenSize,
        gap: config.tokenPool.gap,
        tokens: JSON.stringify(config.products.map((product) => getProductToken(product))),
      },
    }),
    seedWidget('text', gameScene.id, 11, {
      name: 'Hint',
      frame: config.layout.hint,
      props: { text: config.hint },
      style: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: 500, textAlign: 'center' },
    }),
  ];

  const dropZoneWidgetId = gameWidgets.find((widget) => widget.type === 'drop-zone')?.id ?? '';
  Object.values(actions).forEach((action) => {
    if (action.id.startsWith('act_worldcup_drop_')) {
      action.widgetId = dropZoneWidgetId;
    }
  });

  gameScene.widgetIds = gameWidgets.map((widget) => widget.id);
  const scenes = [gameScene, ...endCardScenes.map((item) => item.scene)];
  const widgets = [...gameWidgets, ...endCardScenes.flatMap((item) => item.widgets)];

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
        activeSceneId: gameScene.id,
      },
    },
  };

  return applyProjectPlatformMeta(nextState, options);
}
