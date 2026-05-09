import { useEffect, useRef } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { studioStore } from './studio-store';
import type { StudioState } from '../../domain/document/types';
import { shallowEqual } from './shallow';

export function useStudioStore<T>(selector: (state: StudioState) => T, equalityFn: (a: T, b: T) => boolean = Object.is): T {
  return useSyncExternalStoreWithSelector(
    studioStore.subscribe,
    studioStore.getState,
    studioStore.getState,
    selector,
    equalityFn,
  );
}

export { shallowEqual };

export function useStudioStoreRef<T>(selector: (state: StudioState) => T, equalityFn: (a: T, b: T) => boolean = Object.is): React.MutableRefObject<T> {
  const value = useStudioStore(selector, equalityFn);
  const ref = useRef(value);

  useEffect(() => {
    if (!equalityFn(ref.current, value)) {
      ref.current = value;
    }
  }, [value, equalityFn]);

  return ref;
}
