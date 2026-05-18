import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { playbackEngine } from '../../hooks/use-playback-engine';

type PlayheadRef = MutableRefObject<number>;

const PlayheadRefContext = createContext<PlayheadRef | null>(null);

export function PlayheadRefProvider({ children }: { children: ReactNode }): JSX.Element {
  const ref = useRef(playbackEngine.getCurrentMs());

  useEffect(() => {
    ref.current = playbackEngine.getCurrentMs();
    return playbackEngine.subscribeDom((nextMs) => {
      ref.current = nextMs;
    });
  }, []);

  return <PlayheadRefContext.Provider value={ref}>{children}</PlayheadRefContext.Provider>;
}

export function usePlayheadRef(): PlayheadRef {
  const ref = useContext(PlayheadRefContext);
  if (!ref) {
    throw new Error('usePlayheadRef must be used inside <PlayheadRefProvider>');
  }
  return ref;
}
