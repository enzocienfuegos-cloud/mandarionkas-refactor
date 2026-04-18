import { buildPortableProjectExport, type PortableExportInteraction, type PortableExportProject, type PortableExportScene, type PortableExportWidget } from './portable';
import type { StudioState } from '../domain/document/types';

export type ExportRuntimeGesture =
  | 'tap'
  | 'drag'
  | 'slider'
  | 'scratch'
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
};

export type ExportRuntimeWidget = {
  id: string;
  type: PortableExportWidget['type'];
  sceneId: string;
  frame: PortableExportWidget['frame'];
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
};

function inferWidgetGestures(widget: PortableExportWidget): ExportRuntimeGesture[] {
  const gestures = new Set<ExportRuntimeGesture>();

  widget.interactions.forEach((interaction) => {
    if (interaction.trigger === 'click') gestures.add('tap');
    if (interaction.trigger === 'hover') gestures.add('hover');
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

function buildRuntimeWidget(widget: PortableExportWidget): ExportRuntimeWidget {
  const gestures = inferWidgetGestures(widget);
  return {
    id: widget.id,
    type: widget.type,
    sceneId: widget.sceneId,
    frame: widget.frame,
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
          : interaction.trigger === 'timeline-enter'
            ? 'timeline-enter'
            : 'tap',
      actionType: interaction.type,
      targetWidgetId: interaction.targetWidgetId,
      targetSceneId: interaction.targetSceneId,
      url: interaction.url,
      label: interaction.label,
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
  };
}

export function buildExportRuntimeModel(state: StudioState): ExportRuntimeModel {
  return buildExportRuntimeModelFromPortable(buildPortableProjectExport(state));
}
