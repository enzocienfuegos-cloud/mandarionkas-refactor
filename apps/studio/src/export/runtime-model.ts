import { buildPortableProjectExport, type PortableExportInteraction, type PortableExportProject, type PortableExportScene, type PortableExportWidget } from './portable';
import type { StudioState } from '../domain/document/types';
import { buildCompositorMotionSpec } from '../motion/compositor-motion';
import type { CompositorMotionSpec } from '../motion/motion-template-contract';

export type ExportRuntimeGesture =
  | 'tap'
  | 'drag'
  | 'slider'
  | 'scratch'
  | 'scratch-complete'
  | 'hover'
  | 'timeline-enter'
  | 'scene-enter';

export type ExportRuntimeInteraction = {
  id: string;
  widgetId: string;
  sceneId: string;
  gesture: ExportRuntimeGesture;
  actionType: PortableExportInteraction['type'];
  targetWidgetId?: string;
  targetSceneId?: string;
  url?: string;
  label?: string;
  text?: string;
  eventName?: string;
};

export type ExportRuntimeWidget = {
  id: string;
  type: PortableExportWidget['type'];
  sceneId: string;
  zIndex: number;
  parentId?: string;
  childIds?: string[];
  frame: PortableExportWidget['frame'];
  props: PortableExportWidget['props'];
  style: PortableExportWidget['style'];
  motion?: PortableExportWidget['motion'];
  hoverMotion?: PortableExportWidget['hoverMotion'];
  compositorMotion?: CompositorMotionSpec;
  timeline: PortableExportWidget['timeline'];
  hidden: boolean;
  interactive: boolean;
  gestures: ExportRuntimeGesture[];
  actionIds: string[];
};

export type ExportRuntimeScene = {
  id: string;
  name: string;
  order: number;
  durationMs: number;
  nextSceneId?: string;
  widgets: ExportRuntimeWidget[];
};

export type ExportRuntimeModel = {
  version: 1;
  targetChannel: PortableExportProject['targetChannel'];
  canvas: PortableExportProject['canvas'];
  scenes: ExportRuntimeScene[];
  interactions: ExportRuntimeInteraction[];
  fontFaces: Array<{
    family: string;
    src: string;
  }>;
};

function collectRuntimeFontFaces(project: PortableExportProject): ExportRuntimeModel['fontFaces'] {
  const seen = new Set<string>();
  const fontFaces: ExportRuntimeModel['fontFaces'] = [];

  project.scenes.forEach((scene) => {
    scene.widgets.forEach((widget) => {
      const family = typeof widget.style.fontFamily === 'string' ? widget.style.fontFamily.trim() : '';
      const src = typeof widget.props.fontAssetSrc === 'string' ? widget.props.fontAssetSrc.trim() : '';
      if (!family || !src) return;
      const key = `${family}::${src}`;
      if (seen.has(key)) return;
      seen.add(key);
      fontFaces.push({ family, src });
    });
  });

  return fontFaces;
}

function inferWidgetGestures(widget: PortableExportWidget): ExportRuntimeGesture[] {
  const gestures = new Set<ExportRuntimeGesture>();

  widget.interactions.forEach((interaction) => {
    if (interaction.trigger === 'click') gestures.add('tap');
    if (interaction.trigger === 'hover') gestures.add('hover');
    if (interaction.trigger === 'scratch-complete') gestures.add('scratch-complete');
    if (interaction.trigger === 'timeline-enter') gestures.add('timeline-enter');
  });

  switch (widget.type) {
    case 'cta':
    case 'buttons':
    case 'interactive-hotspot':
    case 'qr-code':
    case 'add-to-calendar':
      gestures.add('tap');
      break;
    case 'range-slider':
    case 'slider':
      gestures.add('drag');
      gestures.add('slider');
      break;
    case 'scratch-reveal':
      gestures.add('drag');
      gestures.add('scratch');
      break;
    case 'group':
      if (widget.props?.scratchEnabled) {
        gestures.add('drag');
        gestures.add('scratch');
      }
      break;
    case 'interactive-gallery':
    case 'image-carousel':
    case 'shoppable-sidebar':
      gestures.add('tap');
      gestures.add('drag');
      break;
    default:
      break;
  }

  return [...gestures];
}

function buildRuntimeCompositorMotion(widget: PortableExportWidget, motion: PortableExportWidget['motion'] | undefined): CompositorMotionSpec | undefined {
  const spec = buildCompositorMotionSpec(motion);
  if (!spec) return undefined;
  if (motion?.templateId !== 'fade-out') return spec;
  const durationMs = Math.max(1, Number(spec.options.duration || 1));
  const timelineDurationMs = Math.max(0, widget.timeline.endMs - widget.timeline.startMs);
  return {
    ...spec,
    options: {
      ...spec.options,
      delay: Math.max(0, timelineDurationMs - durationMs),
    },
  };
}

function buildRuntimeWidget(widget: PortableExportWidget): ExportRuntimeWidget {
  const gestures = inferWidgetGestures(widget);
  const motion = widget.motion ? { ...widget.motion, config: { ...widget.motion.config } } : undefined;
  return {
    id: widget.id,
    type: widget.type,
    sceneId: widget.sceneId,
    zIndex: widget.zIndex,
    parentId: widget.parentId,
    childIds: widget.childIds ? [...widget.childIds] : undefined,
    frame: widget.frame,
    props: widget.props,
    style: widget.style,
    motion,
    hoverMotion: widget.hoverMotion ? { ...widget.hoverMotion, config: { ...widget.hoverMotion.config } } : undefined,
    compositorMotion: buildRuntimeCompositorMotion(widget, motion),
    timeline: widget.timeline,
    hidden: widget.hidden,
    interactive: gestures.length > 0,
    gestures,
    actionIds: widget.interactions.map((interaction) => interaction.id),
  };
}

function buildRuntimeInteractions(scene: PortableExportScene): ExportRuntimeInteraction[] {
  return scene.widgets.flatMap((widget) =>
    widget.interactions.map((interaction) => ({
      id: interaction.id,
      widgetId: widget.id,
      sceneId: scene.id,
      gesture:
        interaction.trigger === 'hover'
          ? 'hover'
          : interaction.trigger === 'scratch-complete'
            ? 'scratch-complete'
          : interaction.trigger === 'timeline-enter'
            ? 'timeline-enter'
            : 'tap',
      actionType: interaction.type,
      targetWidgetId: interaction.targetWidgetId,
      targetSceneId: interaction.targetSceneId,
      url: interaction.url,
      label: interaction.label,
      text: interaction.text,
      eventName: interaction.eventName,
    })),
  );
}

export function buildExportRuntimeModelFromPortable(project: PortableExportProject): ExportRuntimeModel {
  const scenes = project.scenes.map((scene) => ({
    id: scene.id,
    name: scene.name,
    order: scene.order,
    durationMs: scene.durationMs,
    nextSceneId: scene.flow?.nextSceneId,
    widgets: scene.widgets.map(buildRuntimeWidget),
  }));

  return {
    version: 1,
    targetChannel: project.targetChannel,
    canvas: project.canvas,
    scenes,
    interactions: project.scenes.flatMap(buildRuntimeInteractions),
    fontFaces: collectRuntimeFontFaces(project),
  };
}

export function buildExportRuntimeModel(state: StudioState): ExportRuntimeModel {
  return buildExportRuntimeModelFromPortable(buildPortableProjectExport(state));
}
