import type { SceneNode, WidgetNode, WidgetType } from '../../../domain/document/types';
import { buildWorldCupTokenImage } from './badges.svg';
import type { WorldCupStarterConfig, WorldCupStepConfig, WorldCupTokenConfig } from './document';

type WidgetSeedPatch = Partial<Omit<WidgetNode, 'id' | 'type' | 'sceneId' | 'zIndex'>> & {
  frame?: Partial<WidgetNode['frame']>;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  timeline?: Partial<WidgetNode['timeline']>;
};

type SeedWidget = (type: WidgetType, sceneId: string, zIndex: number, patch: WidgetSeedPatch) => WidgetNode;

export function getTokenConfig(config: WorldCupStarterConfig, tokenId: string): WorldCupTokenConfig {
  return config.tokens.find((token) => token.id === tokenId) ?? config.tokens[0];
}

export function getTokenAsset(token: WorldCupTokenConfig) {
  return {
    id: token.id,
    label: token.label,
    accentColor: token.accent,
    src: token.tokenSrc ?? buildWorldCupTokenImage(token.label, token.accent, token.secondary),
  };
}

export function createGameStepScene(
  seedWidget: SeedWidget,
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

  const dropZoneWidget = seedWidget('drop-zone', scene.id, 7, {
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
  });

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
    dropZoneWidget,
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
        dropTargetId: dropZoneWidget.id,
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

export function createEndCardScene(
  seedWidget: SeedWidget,
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
