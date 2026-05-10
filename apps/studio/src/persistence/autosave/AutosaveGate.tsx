import { useEffect, useRef } from 'react';
import { useDocumentActions } from '../../hooks/use-studio-actions';
import { saveAutosaveDraft } from '../../repositories/document';
import { useStudioStore, useStudioStoreRef } from '../../core/store/use-studio-store';
import { createPersistenceSignature, createPersistenceSnapshot } from '../../core/persistence/persistence-snapshot';

export function AutosaveGate(): null {
  const documentActions = useDocumentActions();
  const stateRef = useStudioStoreRef((state) => state);
  const dirty = useStudioStore((state) => state.document.metadata.dirty);
  const persistenceSignature = useStudioStore(createPersistenceSignature);
  const timeoutRef = useRef<number | undefined>(undefined);
  const inFlightRef = useRef(false);
  const queuedSignatureRef = useRef<string | null>(null);
  const lastSignatureRef = useRef('');

  useEffect(() => {
    if (!dirty) {
      queuedSignatureRef.current = null;
      window.clearTimeout(timeoutRef.current);
      return;
    }

    if (persistenceSignature === lastSignatureRef.current) return;

    const flush = () => {
      if (inFlightRef.current) {
        queuedSignatureRef.current = persistenceSignature;
        return;
      }

      inFlightRef.current = true;
      const snapshot = createPersistenceSnapshot(stateRef.current);
      const signature = createPersistenceSignature(snapshot);

      void saveAutosaveDraft(snapshot)
        .then(() => {
          lastSignatureRef.current = signature;
          documentActions.markAutosaved(new Date().toISOString());
        })
        .catch(() => {
          // Keep autosave failures from bubbling as uncaught promise noise.
        })
        .finally(() => {
          inFlightRef.current = false;
          const queuedSignature = queuedSignatureRef.current;
          queuedSignatureRef.current = null;
          if (queuedSignature && queuedSignature !== lastSignatureRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = window.setTimeout(flush, 0);
          }
        });
    };

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(flush, 700);
    return () => {
      window.clearTimeout(timeoutRef.current);
    };
  }, [dirty, documentActions, persistenceSignature, stateRef]);

  return null;
}
