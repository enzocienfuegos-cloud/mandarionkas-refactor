import { useStudioStore } from '../../../core/store/use-studio-store';
import { usePlatformActions } from '../../../platform/runtime';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';
import { useSceneActions, useUiActions, useWidgetActions } from '../../../hooks/use-studio-actions';
import { useLeftRailAssets } from './use-left-rail-assets';
import { CATEGORY_ORDER, type CategoryFilter, useLeftRailWidgetLibrary } from './use-left-rail-widget-library';

export { CATEGORY_ORDER };
export type { AssetFilter, AssetSort, LeftRailAssetsState } from './use-left-rail-assets';
export type { CategoryFilter, LeftRailWidgetLibraryState } from './use-left-rail-widget-library';

export function useLeftRailController() {
  const widgetLibrary = useLeftRailWidgetLibrary();
  const sceneActions = useSceneActions();
  const widgetActions = useWidgetActions();
  const uiActions = useUiActions();
  const platform = usePlatformActions();
  const {
    scene,
    scenes,
    layerIds,
    selectedIds,
    nodes,
    activeSceneId,
    openComments,
    pendingApprovals,
    activeLeftTab,
    primaryWidget,
    targetChannel,
  } = useStudioStore((state) => {
    const scene = state.document.scenes.find((item) => item.id === state.document.selection.activeSceneId)
      ?? state.document.scenes[0];
    return {
      scene,
      scenes: state.document.scenes,
      activeSceneId: state.document.selection.activeSceneId,
      layerIds: [...scene.widgetIds].reverse(),
      selectedIds: state.document.selection.widgetIds,
      nodes: state.document.widgets,
      primaryWidget: state.document.selection.primaryWidgetId ? state.document.widgets[state.document.selection.primaryWidgetId] : undefined,
      openComments: state.document.collaboration.comments.filter((item) => item.status === 'open').length,
      pendingApprovals: state.document.collaboration.approvals.filter((item) => item.status === 'pending').length,
      activeLeftTab: state.ui.activeLeftTab,
      targetChannel: state.document.metadata.release.targetChannel,
    };
  });
  const activeClient = platform.state.clients.find((client) => client.id === platform.state.session.activeClientId);

  const assetLibrary = useLeftRailAssets({
    primaryWidget,
    targetChannel,
    widgetActions,
  });

  return {
    ...widgetLibrary,
    ...assetLibrary,
    sceneActions,
    widgetActions,
    activeClient,
    scene,
    scenes,
    layerIds,
    selectedIds,
    nodes,
    activeSceneId,
    openComments,
    pendingApprovals,
    activeLeftTab,
    primaryWidget,
    getWidgetDefinition,
    targetChannel,
    setActiveLeftTab: uiActions.setLeftTab,
  };
}

export type LeftRailController = ReturnType<typeof useLeftRailController>;
