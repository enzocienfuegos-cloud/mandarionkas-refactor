import { readPlatformState, writePlatformState } from './repository';
import type { PlatformState } from './types';

type Listener = () => void;

let state: PlatformState = readPlatformState();
const listeners = new Set<Listener>();

function notify(): void {
  writePlatformState(state);
  listeners.forEach((listener) => listener());
}

export function getPlatformState(): PlatformState {
  return state;
}

export function subscribePlatformState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updatePlatformState(updater: (current: PlatformState) => PlatformState): PlatformState {
  state = updater(state);
  notify();
  return state;
}

export function replacePlatformState(nextState: PlatformState): PlatformState {
  state = nextState;
  notify();
  return state;
}

export function hydratePlatformState(): PlatformState {
  state = readPlatformState();
  notify();
  return state;
}
