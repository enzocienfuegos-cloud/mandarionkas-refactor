import { resolveWidgetSnapshot } from '../domain/document/resolvers';
import type { ActionNode, StudioState, WidgetNode } from '../domain/document/types';
import { getWidgetDefinition } from '../widgets/registry/widget-registry';

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
  targetWidgetId?: string;
  targetSceneId?: string;
  url?: string;
  text?: string;
};

export type PortableExportWidget = {
  id: string;
  type: WidgetNode['type'];
  name: string;
  sceneId: string;
  zIndex: number;
  hidden: boolean;
  locked: boolean;
  frame: WidgetNode['frame'];
  props: Record<string, unknown>;
  style: Record<string, unknown>;
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
  if (widget.type === 'image' || widget.type === 'hero-image' || src.match(/\.(png|jpe?g|gif|webp|svg)$/i)) return 'image';
  if (widget.type === 'video-hero' || src.match(/\.(mp4|webm|mov)$/i)) return 'video';
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

function collectAssetRefs(widget: WidgetNode): PortableExportAsset[] {
  const candidates = [
    widget.props.src,
    widget.props.posterSrc,
    widget.props.imageSrc,
    widget.props.backgroundImage,
    widget.props.beforeSrc,
    widget.props.afterSrc,
    widget.props.beforeImage,
    widget.props.afterImage,
    ...parseSlideSources(widget.props.slides),
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
      targetWidgetId: action.targetWidgetId,
      targetSceneId: action.targetSceneId,
      url: action.url,
      text: action.text,
    }));
}

function compileWidget(widget: WidgetNode, state: StudioState): PortableExportWidget {
  const snapshot = resolveWidgetSnapshot(widget, state);
  const interactions = collectInteractions(snapshot, state.document.actions);
  const assetRefs = collectAssetRefs(snapshot);
  const definition = getWidgetDefinition(snapshot.type);
  const customPortable = definition.buildPortableExport?.(snapshot, state);

  return {
    id: snapshot.id,
    type: snapshot.type,
    name: snapshot.name,
    sceneId: snapshot.sceneId,
    zIndex: snapshot.zIndex,
    hidden: Boolean(snapshot.hidden),
    locked: Boolean(snapshot.locked),
    frame: { ...snapshot.frame },
    props: { ...snapshot.props },
    style: { ...snapshot.style },
    timeline: { ...snapshot.timeline, keyframes: snapshot.timeline.keyframes?.map((keyframe) => ({ ...keyframe })) },
    variants: snapshot.variants ? { ...snapshot.variants } : undefined,
    conditions: snapshot.conditions ? { ...snapshot.conditions } : undefined,
    interactions,
    assetRefs,
    ...customPortable,
  };
}

export function buildPortableProjectExport(state: StudioState): PortableExportProject {
  const scenes = [...state.document.scenes]
    .sort((a, b) => a.order - b.order)
    .map((scene) => {
      const widgets = scene.widgetIds
        .map((widgetId) => state.document.widgets[widgetId])
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
