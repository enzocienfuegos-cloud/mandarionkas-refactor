import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { AnimationEngine } from './engine';
import { GsapAnimationEngine } from './gsap-engine';

const AnimationEngineContext = createContext<AnimationEngine | null>(null);

export function AnimationEngineProvider({ children }: { children: ReactNode }): JSX.Element {
  const engine = useMemo(() => new GsapAnimationEngine(), []);

  useEffect(() => () => {
    engine.dispose();
  }, [engine]);

  return (
    <AnimationEngineContext.Provider value={engine}>
      {children}
    </AnimationEngineContext.Provider>
  );
}

export function useOptionalAnimationEngine(): AnimationEngine | null {
  return useContext(AnimationEngineContext);
}

export function useAnimationEngine(): AnimationEngine {
  const engine = useOptionalAnimationEngine();
  if (!engine) throw new Error('AnimationEngine not initialized');
  return engine;
}
