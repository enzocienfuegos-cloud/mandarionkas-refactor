import { getFeedCatalogSources, getFeedRecords } from '../../../domain/document/resolvers';
import { useDocumentActions, useSceneActions, useUiActions } from '../../../hooks/use-studio-actions';
import type { DocumentController, TopBarStudioSnapshot } from './top-bar-types';

export function useDocumentController(snapshot: TopBarStudioSnapshot): DocumentController {
  const documentActions = useDocumentActions();
  const sceneActions = useSceneActions();
  const uiActions = useUiActions();

  return {
    documentActions,
    sceneActions,
    uiActions,
    sources: getFeedCatalogSources(snapshot.state),
    records: getFeedRecords(snapshot.activeFeedSource, snapshot.state),
  };
}
