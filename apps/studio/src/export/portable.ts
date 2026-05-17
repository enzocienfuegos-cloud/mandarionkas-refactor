import { buildResolvedWidgetsById } from '../domain/document/canvas-variants';
import { resolveWidgetSnapshot } from '../domain/document/resolvers';
import type { ActionNode, StudioState, WidgetNode } from '../domain/document/types';
import { buildWidgetHoverMotion, buildWidgetMotion } from '../motion/motion-model';
import { rebuildWidgetMotionKeyframes } from '../motion/motion-template-keyframes';
import { getWidgetDefinition } from '../widgets/registry/widget-registry';
import { isImageAssetWidgetType, isVideoAssetWidgetType } from './widget-type-groups';

export type PortableExportAsset = {
  id: string;
  kind: 'image' | 'video' | 'font' | 'unknown';
  src: string;
  widgetId: string;
};

export type PortableExportInteraction = {
  id: string;
  trigger: ActionNode['trigger'];
  type: ActionNode['type'];
  widgetId: string;
  label?: string;
  disabled?: boolean;
  targetWidgetId?: string;
  targetSceneId?: string;
  url?: string;
  target?: '_blank' | '_self';
  text?: string;
  toSeconds?: number;
  overlayId?: string;
  urls?: string[];
  eventName?: string;
  metadata?: Record<string, unknown>;
};

export type PortableExportWidget = {
  id: string;
  type: WidgetNode['type'];
  name: string;
  sceneId: string;
  zIndex: number;
  parentId?: string;
  hidden: boolean;
  locked: boolean;
  frame: WidgetNode['frame'];
  props: Record<string, unknown>;
  style: Record<string, unknown>;
  motion?: WidgetNode['motion'];
  hoverMotion?: WidgetNode['hoverMotion'];
  timeline: WidgetNode['timeline'];
  variants?: WidgetNode['variants'];
  conditions?: WidgetNode['conditions'];
  interactions: PortableExportInteraction[];
  assetRefs: PortableExportAsset[];
};

export type PortableExportScene = {
  id: string;
  name: string;
  order: number;
  durationMs: number;
  transition?: NonNullable<StudioState['document']['scenes'][number]['transition']>;
  flow?: StudioState['document']['scenes'][number]['flow'];
  conditions?: StudioState['document']['scenes'][number]['conditions'];
  widgets: PortableExportWidget[];
};

export type PortableExportProject = {
  version: 1;
  documentId: string;
  name: string;
  canvas: StudioState['document']['canvas'];
  activeVariant: StudioState['ui']['activeVariant'];
  activeFeedSource: StudioState['ui']['activeFeedSource'];
  activeFeedRecordId: StudioState['ui']['activeFeedRecordId'];
  targetChannel: StudioState['document']['metadata']['release']['targetChannel'];
  qaStatus: StudioState['document']['metadata']['release']['qaStatus'];
  scenes: PortableExportScene[];
  interactions: PortableExportInteraction[];
  assets: PortableExportAsset[];
};

function inferAssetKind(widget: WidgetNode, src: string): PortableExportAsset['kind'] {
  if (isImageAssetWidgetType(widget.type) || src.match(/\.(png|jpe?g|gif|webp|svg)$/i)) return 'image';
  if (isVideoAssetWidgetType(widget.type) || src.match(/\.(mp4|webm|mov|m3u8)$/i)) return 'video';
  if (src.match(/\.(woff2?|ttf|otf)$/i)) return 'font';
  return 'unknown';
}

function parseSlideSources(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split('|')[0]?.trim() ?? '')
    .filter(Boolean);
}

function parseShoppableSources(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split('|')[0]?.trim() ?? '')
    .filter(Boolean);
}

function collectAssetRefs(widget: WidgetNode): PortableExportAsset[] {
  const candidates = [
    widget.props.fontAssetSrc,
    widget.props.src,
    widget.props.posterSrc,
    widget.props.imageSrc,
    widget.props.backgroundImage,
    widget.props.heroImage,
    widget.props.logoImage,
    widget.props.beforeSrc,
    widget.props.afterSrc,
    widget.props.beforeImage,
    widget.props.afterImage,
    ...parseSlideSources(widget.props.slides),
    ...parseShoppableSources(widget.props.products),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const seen = new Set<string>();
  return candidates
    .filter((src) => {
      const key = src.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((src, index) => ({
      id: `${widget.id}:asset:${index}`,
      kind: inferAssetKind(widget, src),
      src,
      widgetId: widget.id,
    }));
}

function collectInteractions(widget: WidgetNode, actions: Record<string, ActionNode>): PortableExportInteraction[] {
  return Object.values(actions)
    .filter((action) => action.widgetId === widget.id)
    .map((action) => ({
      id: action.id,
      trigger: action.trigger,
      type: action.type,
      widgetId: widget.id,
      label: action.label,
      disabled: action.disabled,
      targetWidgetId: action.targetWidgetId,
      targetSceneId: action.targetSceneId,
      url: action.url,
      target: action.target,
      text: action.text,
      toSeconds: action.toSeconds,
      overlayId: action.overlayId,
      urls: action.urls,
      eventName: action.eventName,
      metadata: action.metadata,
    }));
}

function resolveExportMotion(widget: WidgetNode): WidgetNode['motion'] {
  if (widget.motion?.templateId) {
    return { ...widget.motion, config: { ...widget.motion.config } };
  }
  const templateId = typeof widget.style.animationPreset === 'string' ? widget.style.animationPreset : '';
  if (!templateId) return undefined;
  return buildWidgetMotion(templateId, {
    durationMs: Number(widget.style.animationDurationMs ?? undefined),
    delayMs: Number(widget.style.animationDelayMs ?? undefined),
    distancePx: Number(widget.style.animationDistancePx ?? undefined),
    intensity: Number(widget.style.animationIntensity ?? undefined),
    repeatMode: String(widget.style.animationRepeatMode ?? 'once'),
  });
}

function resolveExportHoverMotion(widget: WidgetNode): WidgetNode['hoverMotion'] {
  if (widget.hoverMotion?.templateId) {
    return { ...widget.hoverMotion, config: { ...widget.hoverMotion.config } };
  }
  const templateId = typeof widget.style.hoverMotionPreset === 'string' ? widget.style.hoverMotionPreset : '';
  if (!templateId || templateId === 'none') return undefined;
  return buildWidgetHoverMotion(templateId, {
    durationMs: Number(widget.style.hoverMotionDurationMs ?? undefined),
    distancePx: Number(widget.style.hoverMotionDistancePx ?? undefined),
    scale: Number(widget.style.hoverMotionScale ?? undefined),
  });
}

function compileWidget(widget: WidgetNode, state: StudioState): PortableExportWidget {
  const snapshot = resolveWidgetSnapshot(widget, state);
  const interactions = collectInteractions(snapshot, state.document.actions);
  const assetRefs = collectAssetRefs(snapshot);
  const definition = getWidgetDefinition(snapshot.type);
  const customPortable = definition.buildPortableExport?.(snapshot, state);
  const motion = resolveExportMotion(snapshot);
  const hoverMotion = resolveExportHoverMotion(snapshot);
  const keyframes = rebuildWidgetMotionKeyframes(snapshot, motion, snapshot.timeline.keyframes ?? []);

  return {
    id: snapshot.id,
    type: snapshot.type,
    name: snapshot.name,
    sceneId: snapshot.sceneId,
    zIndex: snapshot.zIndex,
    parentId: snapshot.parentId,
    hidden: Boolean(snapshot.hidden),
    locked: Boolean(snapshot.locked),
    frame: { ...snapshot.frame },
    props: { ...snapshot.props },
    style: { ...snapshot.style },
    motion,
    hoverMotion,
    timeline: { ...snapshot.timeline, keyframes: keyframes.map((keyframe) => ({ ...keyframe })) },
    variants: snapshot.variants ? { ...snapshot.variants } : undefined,
    conditions: snapshot.conditions ? { ...snapshot.conditions } : undefined,
    interactions,
    assetRefs,
    ...customPortable,
  };
}

export function buildPortableProjectExport(state: StudioState): PortableExportProject {
  const resolvedWidgets = buildResolvedWidgetsById(state.document);
  const scenes = [...state.document.scenes]
    .sort((a, b) => a.order - b.order)
    .map((scene) => {
      const widgets = scene.widgetIds
        .map((widgetId) => resolvedWidgets[widgetId])
        .filter(Boolean)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((widget) => compileWidget(widget, state));

      return {
        id: scene.id,
        name: scene.name,
        order: scene.order,
        durationMs: scene.durationMs,
        transition: scene.transition ? { ...scene.transition } : undefined,
        flow: scene.flow ? { ...scene.flow, branches: scene.flow.branches?.map((branch) => ({ ...branch })) } : undefined,
        conditions: scene.conditions ? { ...scene.conditions, equals: scene.conditions.equals ? { ...scene.conditions.equals } : undefined } : undefined,
        widgets,
      };
    });

  const interactions = scenes.flatMap((scene) => scene.widgets.flatMap((widget) => widget.interactions));
  const assets = scenes.flatMap((scene) => scene.widgets.flatMap((widget) => widget.assetRefs));

  return {
    version: 1,
    documentId: state.document.id,
    name: state.document.name,
    canvas: { ...state.document.canvas },
    activeVariant: state.ui.activeVariant,
    activeFeedSource: state.ui.activeFeedSource,
    activeFeedRecordId: state.ui.activeFeedRecordId,
    targetChannel: state.document.metadata.release.targetChannel,
    qaStatus: state.document.metadata.release.qaStatus,
    scenes,
    interactions,
    assets,
  };
}
