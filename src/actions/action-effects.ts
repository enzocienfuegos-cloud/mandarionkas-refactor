import type { ActionNode } from '../domain/document/types';

export function runActionEffects(action: ActionNode): void {
  switch (action.type) {
    case 'open-url':
      if (typeof window !== 'undefined' && action.url) {
        window.open(action.url, '_blank', 'noopener,noreferrer');
      }
      return;
    default:
      return;
  }
}
