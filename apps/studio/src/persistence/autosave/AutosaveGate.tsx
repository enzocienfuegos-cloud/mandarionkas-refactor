import { useEffect, useRef } from 'react';
import { useDocumentActions } from '../../hooks/use-studio-actions';
import { saveAutosaveDraft } from '../../repositories/document';
import { useStudioStore, useStudioStoreRef } from '../../core/store/use-studio-store';
import { createPersistenceSnapshot } from '../../core/persistence/persistence-snapshot';
type PersistedDocumentRef = ReturnType<typeof createPersistenceSnapshot>['document'];

function isPersistenceDocumentEqual(left: PersistedDocumentRef, right: PersistedDocumentRef): boolean {
  if (left === right) return true;
  return left.id === right.id
    && left.name === right.name
    && left.version === right.version
    && left.canvas === right.canvas
    && left.canvasVariants === right.canvasVariants
    && left.activeCanvasVariantId === right.activeCanvasVariantId
    && left.widgetOverrides === right.widgetOverrides
    && left.sharedLayers === right.sharedLayers
    && left.scenes === right.scenes
    && left.widgets === right.widgets
    && left.actions === right.actions
    && left.feeds === right.feeds
    && left.collaboration === right.collaboration
    && left.selection === right.selection
    && left.metadata.dirty === right.metadata.dirty
    && left.metadata.lastSavedAt === right.metadata.lastSavedAt
    && left.metadata.release === right.metadata.release
    && left.metadata.platform === right.metadata.platform;
}

export function AutosaveGate(): null {
  const documentActions = useDocumentActions();
  const stateRef = useStudioStoreRef((state) => state);
  const dirty = useStudioStore((state) => state.document.metadata.dirty);
  const documentRef = useStudioStore((state) => state.document, isPersistenceDocumentEqual);
  const timeoutRef = useRef<number | undefined>(undefined);
  const inFlightRef = useRef(false);
  const queuedDocumentRef = useRef<typeof documentRef | null>(null);
  const lastSavedDocumentRef = useRef<typeof documentRef | null>(null);
  const scheduledDocumentRef = useRef<typeof documentRef | null>(null);

  useEffect(() => {
    if (!dirty) {
      queuedDocumentRef.current = null;
      scheduledDocumentRef.current = null;
      window.clearTimeout(timeoutRef.current);
      return;
    }

    if (documentRef === lastSavedDocumentRef.current) return;
    if (documentRef === scheduledDocumentRef.current) return;

    const flush = () => {
      scheduledDocumentRef.current = null;
      if (inFlightRef.current) {
        queuedDocumentRef.current = documentRef;
        return;
      }

      inFlightRef.current = true;
      const snapshot = createPersistenceSnapshot(stateRef.current);
      const savedDocument = stateRef.current.document;

      void saveAutosaveDraft(snapshot)
        .then(() => {
          lastSavedDocumentRef.current = savedDocument;
          documentActions.markAutosaved(new Date().toISOString());
        })
        .catch(() => {
          // Keep autosave failures from bubbling as uncaught promise noise.
        })
        .finally(() => {
          inFlightRef.current = false;
          const queuedDocument = queuedDocumentRef.current;
          queuedDocumentRef.current = null;
          if (queuedDocument && queuedDocument !== lastSavedDocumentRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = window.setTimeout(flush, 0);
          }
        });
    };

    window.clearTimeout(timeoutRef.current);
    scheduledDocumentRef.current = documentRef;
    timeoutRef.current = window.setTimeout(flush, 700);
    return () => {
      window.clearTimeout(timeoutRef.current);
    };
  }, [dirty, documentActions, documentRef, stateRef]);

  return null;
}
