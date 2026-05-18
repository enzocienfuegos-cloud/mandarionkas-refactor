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
  const selectorRef = useRef(selector);
  const equalityRef = useRef(equalityFn);
  const valueRef = useRef(selector(studioStore.getState()));

  useEffect(() => {
    selectorRef.current = selector;
    equalityRef.current = equalityFn;
    const next = selector(studioStore.getState());
    if (!equalityFn(valueRef.current, next)) {
      valueRef.current = next;
    }
  }, [equalityFn, selector]);

  useEffect(() => studioStore.subscribe(() => {
    const next = selectorRef.current(studioStore.getState());
    if (!equalityRef.current(valueRef.current, next)) {
      valueRef.current = next;
    }
  }), []);

  return valueRef;
}

export function useStudioStoreValueRef<T>(selector: (state: StudioState) => T): React.MutableRefObject<T> {
  return useStudioStoreRef(selector);
}

export function useStudioStoreSnapshot(): StudioState {
  return studioStore.getState();
}
