import { attachScratch } from './engine';
import type { ScratchEngineHandle, ScratchMilestone } from './types';

const ATTR_INITIALIZED = 'data-scratch-initialized';

export function initScratchReveal(opts?: {
  selector?: string;
  root?: ParentNode;
}): ScratchEngineHandle[] {
  const selector = opts?.selector ?? '[data-scratch]';
  const root = opts?.root ?? document;
  const handles: ScratchEngineHandle[] = [];
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (el.getAttribute(ATTR_INITIALIZED) === 'true') return;
    try {
      const milestones = readMilestones(el);
      const thresholdPercent = Number(
        el.getAttribute('data-scratch-threshold')
        || el.getAttribute('data-scratch-auto-reveal-threshold')
        || 50,
      );
      const handle = attachScratch({
        root: el,
        threshold: Math.max(0, Math.min(1, thresholdPercent / 100)),
        brushSize: Number(el.getAttribute('data-scratch-radius') || 24),
        activationDelayMs: Number(el.getAttribute('data-scratch-activation-delay') || 0),
        milestones,
      });
      el.setAttribute(ATTR_INITIALIZED, 'true');
      handles.push(handle);
    } catch {
      // Keep reveal visible as a graceful fallback.
    }
  });
  return handles;
}

function readMilestones(el: HTMLElement): ScratchMilestone[] {
  const raw = el.getAttribute('data-scratch-milestones');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{ id?: string; thresholdPercent?: number; at?: number }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => typeof entry?.id === 'string')
      .map((entry) => ({
        id: String(entry.id),
        at: Math.max(
          0,
          Math.min(
            1,
            Number.isFinite(Number(entry.at))
              ? Number(entry.at)
              : Number(entry.thresholdPercent ?? 0) / 100,
          ),
        ),
      }))
      .sort((left, right) => left.at - right.at);
  } catch {
    return [];
  }
}
