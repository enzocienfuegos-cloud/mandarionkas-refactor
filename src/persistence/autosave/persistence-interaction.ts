const listeners = new Set<(active: boolean) => void>();
let activeCount = 0;

function emit(): void {
  const active = activeCount > 0;
  listeners.forEach((listener) => listener(active));
}

export function beginPersistenceInteraction(): void {
  activeCount += 1;
  emit();
}

export function endPersistenceInteraction(): void {
  activeCount = Math.max(0, activeCount - 1);
  emit();
}

export function isPersistenceInteractionActive(): boolean {
  return activeCount > 0;
}

export function subscribePersistenceInteraction(listener: (active: boolean) => void): () => void {
  listeners.add(listener);
  listener(activeCount > 0);
  return () => {
    listeners.delete(listener);
  };
}
