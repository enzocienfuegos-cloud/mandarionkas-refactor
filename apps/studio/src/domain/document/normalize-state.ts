import { createInitialState } from './factories';
import { createCanvasVariantFromCanvas, ensureSingleMasterVariant, syncDocumentCanvasToVariant } from './canvas-variants';
import type { FeedCatalog, StudioState } from './types';

function normalizeFeeds(feeds: StudioState['document']['feeds'] | undefined): FeedCatalog {
  const defaults = createInitialState().document.feeds;
  return {
    product: feeds?.product ?? defaults.product,
    weather: feeds?.weather ?? defaults.weather,
    location: feeds?.location ?? defaults.location,
    custom: feeds?.custom ?? defaults.custom,
  };
}

export function normalizeStudioState(raw: StudioState): StudioState {
  const base = createInitialState();
  const rawLeftTab = raw.ui?.activeLeftTab as string | undefined;
  const normalizedLeftTab = rawLeftTab === 'assets'
    ? 'widgets'
    : ((rawLeftTab as StudioState['ui']['activeLeftTab'] | undefined) ?? base.ui.activeLeftTab);
  const activeSceneId = raw.document.selection?.activeSceneId && raw.document.scenes.some((scene) => scene.id === raw.document.selection.activeSceneId)
    ? raw.document.selection.activeSceneId
    : raw.document.scenes[0]?.id ?? base.document.selection.activeSceneId;
  const rawVariants = raw.document.canvasVariants?.length
    ? raw.document.canvasVariants
    : [createCanvasVariantFromCanvas(raw.document.canvas ?? base.document.canvas, {
        label: `${(raw.document.canvas ?? base.document.canvas).width}×${(raw.document.canvas ?? base.document.canvas).height}`,
        isMaster: true,
      })];
  const canvasVariants = ensureSingleMasterVariant(
    rawVariants.map((variant) => ({
      ...variant,
      presetId: variant.presetId ?? base.document.canvas.presetId ?? 'custom',
      backgroundColor: variant.backgroundColor ?? raw.document.canvas?.backgroundColor ?? base.document.canvas.backgroundColor,
      label: variant.label || `${variant.width}×${variant.height}`,
    })),
    raw.document.activeCanvasVariantId,
  );
  const activeCanvasVariantId = canvasVariants.some((variant) => variant.id === raw.document.activeCanvasVariantId)
    ? raw.document.activeCanvasVariantId
    : canvasVariants[0]?.id ?? base.document.activeCanvasVariantId;

  const normalized: StudioState = {
    document: {
      ...base.document,
      ...raw.document,
      canvasVariants,
      activeCanvasVariantId,
      widgetOverrides: raw.document.widgetOverrides ?? {},
      sharedLayers: raw.document.sharedLayers ?? {},
      feeds: normalizeFeeds(raw.document.feeds),
      selection: {
        widgetIds: raw.document.selection?.widgetIds ?? [],
        primaryWidgetId: raw.document.selection?.primaryWidgetId,
        activeSceneId,
      },
      metadata: {
        dirty: raw.document.metadata?.dirty ?? false,
        lastSavedAt: raw.document.metadata?.lastSavedAt,
        lastAutosavedAt: raw.document.metadata?.lastAutosavedAt,
        release: {
          ...base.document.metadata.release,
          ...(raw.document.metadata?.release ?? {}),
        },
        platform: {
          ...base.document.metadata.platform,
          ...(raw.document.metadata?.platform ?? {}),
        },
      },
    },
    ui: {
      ...base.ui,
      ...raw.ui,
      isPlaying: false,
      previewMode: false,
      previewContext: raw.ui?.previewContext ?? base.ui.previewContext,
      hoveredWidgetId: undefined,
      activeWidgetId: undefined,
      activeLeftTab: normalizedLeftTab,
      stageBackdrop: raw.ui?.stageBackdrop ?? base.ui.stageBackdrop,
      showStageRulers: raw.ui?.showStageRulers ?? base.ui.showStageRulers,
      showWidgetBadges: raw.ui?.showWidgetBadges ?? base.ui.showWidgetBadges,
    },
  };

  return {
    ...normalized,
    document: syncDocumentCanvasToVariant(normalized.document),
  };
}
