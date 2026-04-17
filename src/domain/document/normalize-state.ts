import { createInitialState } from './factories';
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
  const activeSceneId = raw.document.selection?.activeSceneId && raw.document.scenes.some((scene) => scene.id === raw.document.selection.activeSceneId)
    ? raw.document.selection.activeSceneId
    : raw.document.scenes[0]?.id ?? base.document.selection.activeSceneId;

  return {
    document: {
      ...base.document,
      ...raw.document,
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
      hoveredWidgetId: undefined,
      activeWidgetId: undefined,
      activeActionId: undefined,
      activeLeftTab: raw.ui?.activeLeftTab ?? base.ui.activeLeftTab,
      stageBackdrop: raw.ui?.stageBackdrop ?? base.ui.stageBackdrop,
      showStageRulers: raw.ui?.showStageRulers ?? base.ui.showStageRulers,
    },
  };
}
