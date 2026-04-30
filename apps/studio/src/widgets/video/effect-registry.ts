import type { VideoEffectContext } from '../../actions/action-effects';

const registry = new Map<string, VideoEffectContext>();

export function registerVideoEffectContext(widgetId: string, context: VideoEffectContext): void {
  registry.set(widgetId, context);
}

export function unregisterVideoEffectContext(widgetId: string): void {
  registry.delete(widgetId);
}

export function getVideoEffectContext(widgetId: string): VideoEffectContext | undefined {
  return registry.get(widgetId);
}
