import type { StudioCommand } from '../../commands/types';
import { getCanvasPresetById } from '../../../domain/document/canvas-presets';
import { createScene, cloneWidget, createId } from '../../../domain/document/factories';
import { createCanvasVariantFromCanvas, createCanvasVariantFromPreset, ensureSingleMasterVariant, syncDocumentCanvasToVariant } from '../../../domain/document/canvas-variants';
import type { ActionNode, StudioState } from '../../../domain/document/types';
import { resolveNextSceneId } from '../../../domain/document/resolvers';
import { currentScene, withDirty } from '../store-utils';

function cloneVariantOverrides(
  overrides: StudioState['document']['widgetOverrides'][string] | undefined,
): StudioState['document']['widgetOverrides'][string] {
  if (!overrides) return {};
  return Object.fromEntries(
    Object.entries(overrides).map(([widgetId, override]) => [
      widgetId,
      {
        ...override,
        frame: override.frame ? { ...override.frame } : undefined,
        props: override.props ? { ...override.props } : undefined,
        style: override.style ? { ...override.style } : undefined,
        bindings: override.bindings ? { ...override.bindings } : undefined,
        timeline: override.timeline ? { ...override.timeline } : undefined,
        variants: override.variants ? { ...override.variants } : undefined,
        conditions: override.conditions ? { ...override.conditions } : undefined,
      },
    ]),
  );
}

export function documentSceneReducer(state: StudioState, command: StudioCommand): StudioState {
  switch (command.type) {
    case 'UPDATE_DOCUMENT_NAME':
      return withDirty({ ...state, document: { ...state.document, name: command.name } });
    case 'APPLY_CANVAS_PRESET': {
      const preset = getCanvasPresetById(command.presetId);
      if (!preset) return state;
      const nextDocument = syncDocumentCanvasToVariant({
        ...state.document,
        canvasVariants: state.document.canvasVariants.map((variant) => variant.id === state.document.activeCanvasVariantId
          ? {
              ...variant,
              width: preset.width,
              height: preset.height,
              presetId: preset.id,
              label: `${preset.width}×${preset.height}`,
              backgroundColor: preset.backgroundColor ?? variant.backgroundColor,
            }
          : variant),
        canvas: {
          ...state.document.canvas,
          width: preset.width,
          height: preset.height,
          backgroundColor: preset.backgroundColor ?? state.document.canvas.backgroundColor,
          presetId: preset.id,
        },
      });
      return withDirty({ ...state, document: nextDocument });
    }
    case 'ADD_CANVAS_VARIANT': {
      const variant = createCanvasVariantFromPreset(command.presetId, state.document.canvas.backgroundColor);
      if (!variant) return state;
      const duplicate = state.document.canvasVariants.some((item) => item.width === variant.width && item.height === variant.height);
      if (duplicate) return state;
      const nextDocument = syncDocumentCanvasToVariant({
        ...state.document,
        canvasVariants: [...state.document.canvasVariants, variant],
        activeCanvasVariantId: variant.id,
      });
      return withDirty({ ...state, document: nextDocument });
    }
    case 'SELECT_CANVAS_VARIANT': {
      if (!state.document.canvasVariants.some((variant) => variant.id === command.variantId)) return state;
      return {
        ...state,
        document: syncDocumentCanvasToVariant(state.document, command.variantId),
        ui: { ...state.ui, hoveredWidgetId: undefined, activeWidgetId: undefined },
      };
    }
    case 'RENAME_CANVAS_VARIANT': {
      const label = command.label.trim();
      if (!label) return state;
      if (!state.document.canvasVariants.some((variant) => variant.id === command.variantId)) return state;
      return withDirty({
        ...state,
        document: {
          ...state.document,
          canvasVariants: state.document.canvasVariants.map((variant) => variant.id === command.variantId ? { ...variant, label } : variant),
        },
      });
    }
    case 'DUPLICATE_CANVAS_VARIANT': {
      const source = state.document.canvasVariants.find((variant) => variant.id === command.variantId);
      if (!source) return state;
      const variantCopy = {
        ...createCanvasVariantFromCanvas(
          {
            width: source.width,
            height: source.height,
            presetId: source.presetId,
            backgroundColor: source.backgroundColor,
          },
          { label: `${source.label} Copy` },
        ),
        isMaster: false,
      };
      const nextDocument = syncDocumentCanvasToVariant({
        ...state.document,
        canvasVariants: [...state.document.canvasVariants, variantCopy],
        activeCanvasVariantId: variantCopy.id,
        widgetOverrides: {
          ...state.document.widgetOverrides,
          [variantCopy.id]: cloneVariantOverrides(state.document.widgetOverrides[source.id]),
        },
      });
      return withDirty({ ...state, document: nextDocument });
    }
    case 'DELETE_CANVAS_VARIANT': {
      if (state.document.canvasVariants.length <= 1) return state;
      const source = state.document.canvasVariants.find((variant) => variant.id === command.variantId);
      if (!source) return state;
      const remainingVariants = state.document.canvasVariants.filter((variant) => variant.id !== command.variantId);
      const nextActiveVariantId = state.document.activeCanvasVariantId === command.variantId
        ? (remainingVariants.find((variant) => !variant.isMaster)?.id ?? remainingVariants[0]?.id ?? state.document.activeCanvasVariantId)
        : state.document.activeCanvasVariantId;
      const nextWidgetOverrides = { ...state.document.widgetOverrides };
      delete nextWidgetOverrides[command.variantId];
      const normalizedVariants = ensureSingleMasterVariant(
        remainingVariants,
        source.isMaster ? nextActiveVariantId : remainingVariants.find((variant) => variant.isMaster)?.id,
      );
      return withDirty({
        ...state,
        document: syncDocumentCanvasToVariant({
          ...state.document,
          canvasVariants: normalizedVariants,
          activeCanvasVariantId: nextActiveVariantId,
          widgetOverrides: nextWidgetOverrides,
        }, nextActiveVariantId),
      });
    }
    case 'SET_MASTER_CANVAS_VARIANT': {
      if (!state.document.canvasVariants.some((variant) => variant.id === command.variantId)) return state;
      return withDirty({
        ...state,
        document: {
          ...state.document,
          canvasVariants: ensureSingleMasterVariant(state.document.canvasVariants, command.variantId),
        },
      });
    }
    case 'UPDATE_CANVAS_SIZE': {
      const nextDocument = syncDocumentCanvasToVariant({
        ...state.document,
        canvasVariants: state.document.canvasVariants.map((variant) => variant.id === state.document.activeCanvasVariantId
          ? {
              ...variant,
              width: Math.max(1, command.width),
              height: Math.max(1, command.height),
              presetId: 'custom',
              label: `${Math.max(1, command.width)}×${Math.max(1, command.height)}`,
            }
          : variant),
      });
      return withDirty({ ...state, document: nextDocument });
    }
    case 'UPDATE_CANVAS_BACKGROUND': {
      const nextDocument = syncDocumentCanvasToVariant({
        ...state.document,
        canvasVariants: state.document.canvasVariants.map((variant) => variant.id === state.document.activeCanvasVariantId
          ? { ...variant, backgroundColor: command.backgroundColor }
          : variant),
      });
      return withDirty({ ...state, document: nextDocument });
    }
    case 'ADD_SCENE': {
      const order = state.document.scenes.length;
      const scene = createScene(order);
      return withDirty({
        ...state,
        document: {
          ...state.document,
          scenes: [...state.document.scenes, scene],
          selection: { ...state.document.selection, activeSceneId: scene.id, widgetIds: [], primaryWidgetId: undefined },
        },
        ui: { ...state.ui, playheadMs: 0 },
      });
    }
    case 'ADD_SCENE_FROM_CURRENT': {
      const sourceScene = currentScene(state);
      if (!sourceScene) return state;
      const scene = createScene(state.document.scenes.length);
      scene.widgetIds = [...sourceScene.widgetIds];
      return withDirty({
        ...state,
        document: {
          ...state.document,
          scenes: [...state.document.scenes, scene],
          selection: { ...state.document.selection, activeSceneId: scene.id, widgetIds: [], primaryWidgetId: undefined },
        },
        ui: { ...state.ui, playheadMs: 0 },
      });
    }
    case 'SELECT_SCENE': {
      const sceneExists = state.document.scenes.some((scene) => scene.id === command.sceneId);
      if (!sceneExists) return state;
      return { ...state, document: { ...state.document, selection: { ...state.document.selection, activeSceneId: command.sceneId, widgetIds: [], primaryWidgetId: undefined } }, ui: { ...state.ui, playheadMs: 0, activeWidgetId: undefined, hoveredWidgetId: undefined } };
    }
    case 'DUPLICATE_SCENE': {
      const source = state.document.scenes.find((scene) => scene.id === command.sceneId);
      if (!source) return state;
      const widgets = { ...state.document.widgets };
      const actions = { ...state.document.actions };
      const idMap = new Map<string, string>();
      const sceneClone = createScene(state.document.scenes.length, `${source.name} Copy`);
      sceneClone.durationMs = source.durationMs;
      sceneClone.conditions = JSON.parse(JSON.stringify(source.conditions ?? {}));
      sceneClone.flow = JSON.parse(JSON.stringify(source.flow ?? {}));
      if (sceneClone.flow?.canvas) {
        sceneClone.flow.canvas = {
          x: sceneClone.flow.canvas.x + 40,
          y: sceneClone.flow.canvas.y + 40,
        };
      }
      sceneClone.widgetIds = source.widgetIds.map((widgetId) => {
        const original = state.document.widgets[widgetId];
        if (!original) return '';
        const clone = cloneWidget({ ...original, sceneId: sceneClone.id }, `${original.name} Copy`, { preserveFrame: true });
        idMap.set(original.id, clone.id);
        widgets[clone.id] = clone;
        return clone.id;
      }).filter(Boolean);
      sceneClone.widgetIds.forEach((widgetId) => {
        const widget = widgets[widgetId];
        if (!widget) return;
        if (widget.parentId) widget.parentId = idMap.get(widget.parentId);
        if (widget.childIds?.length) widget.childIds = widget.childIds.map((id) => idMap.get(id) ?? id);
      });
      Object.values(state.document.actions).forEach((action) => {
        const newWidgetId = idMap.get(action.widgetId);
        if (!newWidgetId) return;
        const actionId = createId('act');
        actions[actionId] = { ...action, id: actionId, widgetId: newWidgetId, targetWidgetId: action.targetWidgetId ? (idMap.get(action.targetWidgetId) ?? action.targetWidgetId) : undefined };
      });
      return withDirty({
        ...state,
        document: {
          ...state.document,
          widgets,
          actions,
          scenes: [...state.document.scenes, sceneClone].map((scene, index) => ({ ...scene, order: index })),
          selection: { ...state.document.selection, activeSceneId: sceneClone.id, widgetIds: [], primaryWidgetId: undefined },
        },
        ui: { ...state.ui, playheadMs: 0 },
      });
    }
    case 'DELETE_SCENE': {
      if (state.document.scenes.length <= 1) return state;
      const scene = state.document.scenes.find((item) => item.id === command.sceneId);
      if (!scene) return state;
      const widgets = { ...state.document.widgets };
      const actions = { ...state.document.actions };
      scene.widgetIds.forEach((widgetId) => delete widgets[widgetId]);
      Object.values(actions).forEach((action) => {
        if (scene.widgetIds.includes(action.widgetId) || (action.targetWidgetId && scene.widgetIds.includes(action.targetWidgetId))) delete actions[action.id];
      });
      const scenes = state.document.scenes.filter((item) => item.id !== command.sceneId).map((item, index) => ({ ...item, order: index, flow: { ...item.flow, nextSceneId: item.flow?.nextSceneId === command.sceneId ? undefined : item.flow?.nextSceneId, branchEquals: item.flow?.branchEquals?.targetSceneId === command.sceneId ? undefined : item.flow?.branchEquals } }));
      const activeSceneId = state.document.selection.activeSceneId === command.sceneId ? scenes[0].id : state.document.selection.activeSceneId;
      return withDirty({ ...state, document: { ...state.document, widgets, actions, scenes, selection: { ...state.document.selection, activeSceneId, widgetIds: [], primaryWidgetId: undefined } }, ui: { ...state.ui, playheadMs: 0 } });
    }
    case 'REORDER_SCENES': {
      const { fromIndex, toIndex } = command;
      if (fromIndex === toIndex) return state;
      const scenes = [...state.document.scenes].sort((left, right) => left.order - right.order);
      if (fromIndex < 0 || fromIndex >= scenes.length) return state;
      if (toIndex < 0 || toIndex >= scenes.length) return state;
      const [moved] = scenes.splice(fromIndex, 1);
      if (!moved) return state;
      scenes.splice(toIndex, 0, moved);
      return withDirty({
        ...state,
        document: {
          ...state.document,
          scenes: scenes.map((scene, index) => ({ ...scene, order: index })),
        },
      });
    }
    case 'UPDATE_SCENE':
      return withDirty({ ...state, document: { ...state.document, scenes: state.document.scenes.map((scene) => scene.id === command.sceneId ? { ...scene, ...command.patch } : scene) } });
    case 'GO_TO_NEXT_SCENE': {
      const nextSceneId = resolveNextSceneId(state, state.document.selection.activeSceneId);
      if (!nextSceneId) return state;
      return { ...state, document: { ...state.document, selection: { ...state.document.selection, activeSceneId: nextSceneId, widgetIds: [], primaryWidgetId: undefined } }, ui: { ...state.ui, playheadMs: 0, activeWidgetId: undefined, hoveredWidgetId: undefined } };
    }
    case 'GO_TO_PREVIOUS_SCENE': {
      const scenes = [...state.document.scenes].sort((a, b) => a.order - b.order);
      const index = scenes.findIndex((scene) => scene.id === state.document.selection.activeSceneId);
      const previous = index > 0 ? scenes[index - 1] : undefined;
      if (!previous) return state;
      return { ...state, document: { ...state.document, selection: { ...state.document.selection, activeSceneId: previous.id, widgetIds: [], primaryWidgetId: undefined } }, ui: { ...state.ui, playheadMs: 0, activeWidgetId: undefined, hoveredWidgetId: undefined } };
    }
    case 'SET_ACTIVE_VARIANT':
      return { ...state, ui: { ...state.ui, activeVariant: command.variant } };
    case 'SET_ACTIVE_FEED_SOURCE': {
      const records = state.document.feeds[command.source] ?? [];
      return { ...state, ui: { ...state.ui, activeFeedSource: command.source, activeFeedRecordId: records[0]?.id ?? '' } };
    }
    case 'SET_ACTIVE_FEED_RECORD':
      return { ...state, ui: { ...state.ui, activeFeedRecordId: command.recordId } };
    case 'UPSERT_FEED_RECORD': {
      const sourceRecords = [...(state.document.feeds[command.source] ?? [])];
      const idx = sourceRecords.findIndex((item) => item.id === command.record.id);
      if (idx >= 0) sourceRecords[idx] = command.record;
      else sourceRecords.push(command.record);
      return withDirty({
        ...state,
        document: { ...state.document, feeds: { ...state.document.feeds, [command.source]: sourceRecords } },
        ui: { ...state.ui, activeFeedSource: command.source, activeFeedRecordId: command.record.id },
      });
    }
    case 'DELETE_FEED_RECORD': {
      const sourceRecords = (state.document.feeds[command.source] ?? []).filter((item) => item.id !== command.recordId);
      const nextRecordId = state.ui.activeFeedSource === command.source && state.ui.activeFeedRecordId === command.recordId ? (sourceRecords[0]?.id ?? '') : state.ui.activeFeedRecordId;
      return withDirty({
        ...state,
        document: { ...state.document, feeds: { ...state.document.feeds, [command.source]: sourceRecords } },
        ui: { ...state.ui, activeFeedRecordId: nextRecordId },
      });
    }
    default:
      return state;
  }
}
