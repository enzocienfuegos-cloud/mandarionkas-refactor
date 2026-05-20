import type { SceneManager } from './scene-manager';
import { isHTMLElement, parseJsonAttribute, shouldShowMediaCaption, wrapIndex } from './runtime-dom';
import type { ExportRuntimeModel } from './runtime-model';

type InteractiveRuntimeOptions = {
  runtimeModel: ExportRuntimeModel;
  performExit: (url: string) => void;
  resolveExitUrl: (widgetId: string) => string;
  sceneManager: Pick<SceneManager, 'nextScene' | 'findSceneIndexById' | 'showScene'>;
};

type CarouselSlide = {
  src?: string;
  caption?: string;
};

type ShoppableProduct = {
  title?: string;
};

type FormRoot = HTMLElement & {
  __smxDraftTimer?: number;
};

type HotspotRoot = HTMLElement & {
  __smxHotspotTimer?: number;
};

function getWidgetRoot(widgetId: string, selector: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-widget-id="${widgetId}"]${selector}`);
}

function getInputValue(root: Element, key: 'one' | 'two' | 'three'): string {
  const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-form-input="${key}"]`);
  return input?.value ?? '';
}

function getChecked(root: Element, selector: string): boolean {
  const input = root.querySelector<HTMLInputElement>(selector);
  return Boolean(input?.checked);
}

function applyCarouselIndex(root: HTMLElement, nextIndex: number): void {
  const slides = parseJsonAttribute<CarouselSlide[]>(root, 'data-carousel-slides', []);
  const accent = root.getAttribute('data-carousel-accent') || '#ffffff';
  if (!Array.isArray(slides) || !slides.length) return;
  const normalizedIndex = wrapIndex(nextIndex, slides.length);
  root.setAttribute('data-carousel-index', String(normalizedIndex));
  const activeSlide = slides[normalizedIndex];
  const image = root.querySelector<HTMLImageElement>('[data-carousel-image]');
  const caption = root.querySelector<HTMLElement>('[data-carousel-caption]');
  if (image) {
    image.setAttribute('src', activeSlide?.src || '');
    image.setAttribute('alt', shouldShowMediaCaption(activeSlide?.caption) ? String(activeSlide?.caption) : '');
  }
  if (caption) {
    const visible = shouldShowMediaCaption(activeSlide?.caption);
    caption.textContent = visible ? String(activeSlide?.caption) : '';
    caption.style.display = visible ? 'block' : 'none';
  }
  root.querySelectorAll<HTMLElement>('[data-carousel-target]').forEach((dot) => {
    const targetIndex = Number(dot.getAttribute('data-carousel-target') || 0);
    dot.style.background = targetIndex === normalizedIndex ? accent : 'rgba(255,255,255,.45)';
  });
}

function applyGalleryIndex(root: HTMLElement, nextIndex: number): void {
  const slides = parseJsonAttribute<CarouselSlide[]>(root, 'data-gallery-slides', []);
  const accent = root.getAttribute('data-gallery-accent') || '#111827';
  const total = Math.max(1, Array.isArray(slides) && slides.length ? slides.length : Number(root.getAttribute('data-gallery-count') || 4));
  const normalizedIndex = wrapIndex(nextIndex, total);
  root.setAttribute('data-gallery-index', String(normalizedIndex));
  const activeSlide = Array.isArray(slides) ? slides[normalizedIndex] : null;
  const card = root.querySelector<HTMLElement>('[data-gallery-card]');
  const image = root.querySelector<HTMLImageElement>('[data-gallery-image]');
  const caption = root.querySelector<HTMLElement>('[data-gallery-caption]');
  const count = root.querySelector<HTMLElement>('[data-gallery-count]');
  if (image && activeSlide) {
    image.setAttribute('src', activeSlide.src || '');
    image.setAttribute('alt', shouldShowMediaCaption(activeSlide.caption) ? String(activeSlide.caption) : '');
  }
  if (caption && activeSlide) {
    const visible = shouldShowMediaCaption(activeSlide.caption);
    caption.textContent = visible ? String(activeSlide.caption) : '';
    caption.style.display = visible ? 'block' : 'none';
  }
  if (count) count.textContent = `${normalizedIndex + 1} / ${total}`;
  if (!image && card) card.textContent = `${normalizedIndex + 1} / ${total}`;
  root.querySelectorAll<HTMLElement>('[data-gallery-target]').forEach((dot) => {
    const targetIndex = Number(dot.getAttribute('data-gallery-target') || 0);
    dot.style.background = targetIndex === normalizedIndex ? accent : 'rgba(255,255,255,.4)';
  });
}

function applyShoppableIndex(root: HTMLElement, nextIndex: number): void {
  const products = parseJsonAttribute<ShoppableProduct[]>(root, 'data-shoppable-products', []);
  if (!Array.isArray(products) || !products.length) return;
  const orientation = root.getAttribute('data-shoppable-layout') || 'horizontal';
  const normalizedIndex = wrapIndex(nextIndex, products.length);
  root.setAttribute('data-shoppable-index', String(normalizedIndex));
  const track = root.querySelector<HTMLElement>('[data-shoppable-track]');
  if (!track) return;
  const gap = 12;
  const firstCard = track.querySelector<HTMLElement>('[data-shoppable-card]');
  const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : Number(root.getAttribute('data-shoppable-card-width') || 124);
  const cardHeight = firstCard ? firstCard.getBoundingClientRect().height : Number(root.getAttribute('data-shoppable-card-height') || 164);
  track.style.transform = orientation === 'vertical'
    ? `translateY(-${normalizedIndex * (cardHeight + gap)}px)`
    : `translateX(-${normalizedIndex * (cardWidth + gap)}px)`;
}

async function submitDraft(root: FormRoot): Promise<void> {
  const submitTargetType = root.getAttribute('data-form-target-type') || 'none';
  const submitUrl = root.getAttribute('data-form-submit-url') || '';
  const method = root.getAttribute('data-form-method') || 'POST';
  const consentRequired = root.getAttribute('data-form-consent-required') === 'true';
  if (submitTargetType !== 'webhook' || !submitUrl) return;
  try {
    await fetch(submitUrl, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          [root.getAttribute('data-form-field-one') || 'fieldOne']: getInputValue(root, 'one'),
          [root.getAttribute('data-form-field-two') || 'fieldTwo']: getInputValue(root, 'two'),
          [root.getAttribute('data-form-field-three') || 'fieldThree']: getInputValue(root, 'three'),
          consent: consentRequired ? String(getChecked(root, '[data-form-consent]')) : 'not-required',
        },
        widgetId: root.getAttribute('data-widget-id') || '',
        event: 'draft',
      }),
    });
  } catch {
    // Draft submission is best effort in exported banners.
  }
}

function scheduleDraft(root: FormRoot, delayMs: number): void {
  if (root.__smxDraftTimer) window.clearTimeout(root.__smxDraftTimer);
  root.__smxDraftTimer = window.setTimeout(() => {
    root.__smxDraftTimer = 0;
    void submitDraft(root);
  }, delayMs);
}

async function submitForm(root: FormRoot): Promise<void> {
  const submitTargetType = root.getAttribute('data-form-target-type') || 'none';
  const submitUrl = root.getAttribute('data-form-submit-url') || '';
  const method = root.getAttribute('data-form-method') || 'POST';
  const successMessage = root.getAttribute('data-form-success-message') || 'Submitted';
  const consentRequired = root.getAttribute('data-form-consent-required') === 'true';
  const consentChecked = getChecked(root, '[data-form-consent]');
  const status = root.querySelector<HTMLElement>('[data-form-status]');
  const button = root.querySelector<HTMLButtonElement>('[type="submit"]');
  if (consentRequired && !consentChecked) {
    if (status) status.textContent = 'Accept consent to continue';
    return;
  }
  if (button) button.textContent = 'Submitting…';
  try {
    if (submitTargetType === 'webhook' && submitUrl) {
      await fetch(submitUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            [root.getAttribute('data-form-field-one') || 'fieldOne']: getInputValue(root, 'one'),
            [root.getAttribute('data-form-field-two') || 'fieldTwo']: getInputValue(root, 'two'),
            [root.getAttribute('data-form-field-three') || 'fieldThree']: getInputValue(root, 'three'),
            consent: consentRequired ? String(consentChecked) : 'not-required',
          },
          widgetId: root.getAttribute('data-widget-id') || '',
        }),
      });
    }
    if (status) status.textContent = successMessage;
    if (button) button.textContent = successMessage;
  } catch {
    if (status) status.textContent = 'Retry submit';
    if (button) button.textContent = 'Retry submit';
  }
}

function toggleHotspot(root: HotspotRoot): void {
  const panel = root.querySelector<HTMLElement>('[data-hotspot-panel]');
  const label = root.querySelector<HTMLElement>('[data-hotspot-label]');
  const isOpen = panel?.style.display === 'grid';
  const autoCloseMs = Math.max(0, Number(root.getAttribute('data-hotspot-auto-close-ms') || 0));
  if (root.__smxHotspotTimer) {
    window.clearTimeout(root.__smxHotspotTimer);
    root.__smxHotspotTimer = 0;
  }
  if (panel) panel.style.display = isOpen ? 'none' : 'grid';
  if (label) label.style.display = isOpen ? 'block' : 'none';
  if (!isOpen && autoCloseMs > 0) {
    root.__smxHotspotTimer = window.setTimeout(() => {
      if (panel) panel.style.display = 'none';
      if (label) label.style.display = 'block';
      root.__smxHotspotTimer = 0;
    }, autoCloseMs);
  }
}

function runSpeedTest(root: HTMLElement, rafs: Map<string, number>): void {
  const widgetId = root.getAttribute('data-widget-id') || '';
  if (!widgetId || root.getAttribute('data-speed-running') === 'true') return;
  const min = Number(root.getAttribute('data-speed-min') || 10);
  const max = Number(root.getAttribute('data-speed-max') || 100);
  const fixedValue = Number(root.getAttribute('data-speed-current') || 64);
  const duration = Math.max(300, Number(root.getAttribute('data-speed-duration') || 1800));
  const mode = root.getAttribute('data-speed-result-mode') || 'random';
  const units = root.getAttribute('data-speed-units') || 'Mbps';
  const fastThreshold = Number(root.getAttribute('data-speed-fast-threshold') || 70);
  const fastMessage = root.getAttribute('data-speed-fast-message') || 'WOW, very fast network';
  const slowMessage = root.getAttribute('data-speed-slow-message') || 'Slow connection';
  const button = root.querySelector<HTMLElement>('[data-smx-action="speed-test-start"]');
  const value = root.querySelector<HTMLElement>('[data-speed-value]');
  const bar = root.querySelector<HTMLElement>('[data-speed-bar]');
  const status = root.querySelector<HTMLElement>('[data-speed-status]');
  const needle = root.querySelector<HTMLElement>('[data-speed-needle]');
  const target = mode === 'fixed'
    ? Math.max(min, Math.min(max, fixedValue))
    : Math.max(min, Math.min(max, Math.round(min + Math.random() * Math.max(1, max - min))));
  const startedAt = performance.now();

  root.setAttribute('data-speed-running', 'true');
  if (button) button.textContent = 'Testing…';
  if (bar) bar.style.width = '0%';
  if (value) value.innerHTML = `${min}<span style="font-size:13px;opacity:.8;"> ${units}</span>`;

  const tick = (now: number): void => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(min + (target - min) * eased);
    const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
    const isFast = current >= fastThreshold;
    if (bar) {
      bar.style.width = `${pct}%`;
      bar.style.background = isFast ? '#22c55e' : '#ef4444';
    }
    if (needle) {
      needle.style.background = isFast ? '#22c55e' : '#ef4444';
      needle.style.boxShadow = `0 0 16px ${isFast ? '#22c55e' : '#ef4444'}`;
      needle.style.transform = `translateX(-50%) rotate(${-92 + pct * 1.84}deg)`;
    }
    if (value) value.innerHTML = `${current}<span style="font-size:13px;opacity:.8;"> ${units}</span>`;
    if (status) {
      status.textContent = isFast ? fastMessage : slowMessage;
      status.style.color = isFast ? '#22c55e' : '#ef4444';
    }
    if (progress < 1) {
      rafs.set(widgetId, window.requestAnimationFrame(tick));
      return;
    }
    rafs.delete(widgetId);
    root.setAttribute('data-speed-running', 'false');
    root.setAttribute('data-speed-current', String(target));
    if (button) button.textContent = button.getAttribute('data-original-label') || button.textContent || 'Start test';
  };

  rafs.set(widgetId, window.requestAnimationFrame(tick));
}

// ─── Drag token runtime ───────────────────────────────────────────────────────
// Implements pointer-based drag-and-drop for drag-token-pool → drop-zone widgets.
// Uses only vanilla DOM — no React or external dependencies.

type DragState = {
  tokenEl: HTMLElement;
  ghost: HTMLElement;
  ghostW: number;
  ghostH: number;
  tokenId: string;
  targetSceneId: string;
  targetActionId: string;
  sourceWidgetId: string;
  dropTargetId: string;
  tokenImage: string;
  startX: number;
  startY: number;
  currentDropZone: HTMLElement | null;
};

function createDragGhost(tokenEl: HTMLElement): HTMLElement {
  const ghost = tokenEl.cloneNode(true) as HTMLElement;
  const rect = tokenEl.getBoundingClientRect();
  // Use direct property setters — avoids conflicts with pre-existing inline cssText
  ghost.style.setProperty('position', 'fixed', 'important');
  ghost.style.setProperty('width', `${rect.width}px`, 'important');
  ghost.style.setProperty('height', `${rect.height}px`, 'important');
  ghost.style.setProperty('left', `${rect.left}px`, 'important');
  ghost.style.setProperty('top', `${rect.top}px`, 'important');
  ghost.style.setProperty('pointer-events', 'none', 'important');
  ghost.style.setProperty('z-index', '99999', 'important');
  ghost.style.setProperty('opacity', '0.85', 'important');
  ghost.style.setProperty('transform', 'scale(1.08)', 'important');
  ghost.style.setProperty('transition', 'transform 0.1s ease-out', 'important');
  ghost.style.setProperty('will-change', 'transform,left,top', 'important');
  ghost.style.setProperty('cursor', 'grabbing', 'important');
  ghost.style.setProperty('margin', '0', 'important');
  ghost.removeAttribute('data-smx-action');
  document.body.appendChild(ghost);
  return ghost;
}

function findDropZoneAt(x: number, y: number, excludeSource: string): HTMLElement | null {
  // elementFromPoint ignores pointer-events:none, so use elementsFromPoint
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    if (!(el instanceof HTMLElement)) continue;
    const zone = el.closest<HTMLElement>('[data-smx-action="drop-zone"]');
    if (zone && zone.getAttribute('data-drop-zone-id') !== excludeSource) return zone;
  }
  return null;
}

function highlightDropZone(zone: HTMLElement | null, active: boolean): void {
  if (!zone) return;
  const highlight = zone.querySelector<HTMLElement>('.smx-drop-zone-highlight');
  if (highlight) highlight.style.opacity = active ? '1' : '0';
}

function mountDragTokenRuntime(sceneManager: Pick<SceneManager, 'findSceneIndexById' | 'showScene'>): () => void {
  let drag: DragState | null = null;

  const onPointerDown = (event: PointerEvent): void => {
    if (!isHTMLElement(event.target)) return;
    const tokenEl = event.target.closest<HTMLElement>('[data-smx-action="token-drag"]');
    if (!tokenEl) return;
    if (tokenEl.getAttribute('data-token-disabled') === 'true') return;
    event.preventDefault();
    event.stopPropagation();

    const ghost = createDragGhost(tokenEl);
    const ghostRect = ghost.getBoundingClientRect();
    drag = {
      tokenEl,
      ghost,
      ghostW: ghostRect.width,
      ghostH: ghostRect.height,
      tokenId: tokenEl.getAttribute('data-token-id') || '',
      targetSceneId: tokenEl.getAttribute('data-target-scene-id') || '',
      targetActionId: tokenEl.getAttribute('data-target-action-id') || '',
      sourceWidgetId: tokenEl.getAttribute('data-source-widget-id') || '',
      dropTargetId: tokenEl.getAttribute('data-drop-target-id') || '',
      tokenImage: tokenEl.getAttribute('data-token-image') || '',
      startX: event.clientX,
      startY: event.clientY,
      currentDropZone: null,
    };
    tokenEl.style.opacity = '0.35';
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!drag) return;
    event.preventDefault();
    const { ghost, ghostW, ghostH, dropTargetId } = drag;
    // Use cached dimensions — avoids re-layout thrashing every frame
    ghost.style.setProperty('left', `${event.clientX - ghostW / 2}px`, 'important');
    ghost.style.setProperty('top', `${event.clientY - ghostH / 2}px`, 'important');

    const zone = findDropZoneAt(event.clientX, event.clientY, dropTargetId);
    if (zone !== drag.currentDropZone) {
      highlightDropZone(drag.currentDropZone, false);
      highlightDropZone(zone, true);
      drag.currentDropZone = zone;
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!drag) return;
    event.preventDefault();
    const { ghost, tokenEl, targetSceneId, dropTargetId } = drag;
    // Do a final position check — currentDropZone may be null if pointermove was never fired
    const finalDropZone = drag.currentDropZone ?? findDropZoneAt(event.clientX, event.clientY, dropTargetId);
    ghost.remove();
    tokenEl.style.opacity = '';
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    highlightDropZone(finalDropZone, false);

    if (finalDropZone && targetSceneId) {
      const sceneIndex = sceneManager.findSceneIndexById(targetSceneId);
      if (sceneIndex >= 0) {
        // Mark this token as used
        tokenEl.setAttribute('data-token-disabled', 'true');
        tokenEl.style.opacity = '0.35';
        tokenEl.style.cursor = 'not-allowed';
        sceneManager.showScene(sceneIndex);
      }
    }

    drag = null;
  };

  const onPointerCancel = (): void => {
    if (!drag) return;
    drag.ghost.remove();
    drag.tokenEl.style.opacity = '';
    highlightDropZone(drag.currentDropZone, false);
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    drag = null;
  };

  document.addEventListener('pointerdown', onPointerDown, { capture: true });
  document.addEventListener('pointermove', onPointerMove, { passive: false });
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerCancel);

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, { capture: true });
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerCancel);
    if (drag) {
      drag.ghost.remove();
      drag.tokenEl.style.opacity = '';
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      drag = null;
    }
  };
}

export function mountInteractiveRuntime({ runtimeModel, performExit, resolveExitUrl, sceneManager }: InteractiveRuntimeOptions): { dispose(): void } {
  const shoppableIntervals = new Set<number>();
  const speedTestRafs = new Map<string, number>();
  const disposeDragRuntime = mountDragTokenRuntime(sceneManager);

  const handleClick = (event: MouseEvent): void => {
    if (!isHTMLElement(event.target)) return;
    const actionNode = event.target.closest<HTMLElement>('[data-smx-action]');
    if (!actionNode) return;
    const action = actionNode.getAttribute('data-smx-action') || '';

    if (action === 'qr-open') {
      event.preventDefault();
      performExit(actionNode.getAttribute('data-qr-url') || '');
      return;
    }

    if (action === 'carousel-prev' || action === 'carousel-next' || action === 'carousel-dot') {
      event.preventDefault();
      const widgetId = actionNode.getAttribute('data-widget-id') || '';
      const root = getWidgetRoot(widgetId, '.widget-image-carousel');
      const currentIndex = Number(root?.getAttribute('data-carousel-index') || 0);
      if (root) {
        applyCarouselIndex(
          root,
          action === 'carousel-prev'
            ? currentIndex - 1
            : action === 'carousel-next'
              ? currentIndex + 1
              : Number(actionNode.getAttribute('data-carousel-target') || 0),
        );
      }
      return;
    }

    if (action === 'gallery-prev' || action === 'gallery-next' || action === 'gallery-dot') {
      event.preventDefault();
      const widgetId = actionNode.getAttribute('data-widget-id') || '';
      const root = getWidgetRoot(widgetId, '.widget-interactive-gallery');
      const currentIndex = Number(root?.getAttribute('data-gallery-index') || 0);
      if (root) {
        applyGalleryIndex(
          root,
          action === 'gallery-prev'
            ? currentIndex - 1
            : action === 'gallery-next'
              ? currentIndex + 1
              : Number(actionNode.getAttribute('data-gallery-target') || 0),
        );
      }
      return;
    }

    if (action === 'shoppable-prev' || action === 'shoppable-next') {
      event.preventDefault();
      const widgetId = actionNode.getAttribute('data-widget-id') || '';
      const root = getWidgetRoot(widgetId, '.widget-shoppable-sidebar');
      const currentIndex = Number(root?.getAttribute('data-shoppable-index') || 0);
      if (root) applyShoppableIndex(root, action === 'shoppable-prev' ? currentIndex - 1 : currentIndex + 1);
      return;
    }

    if (action === 'shoppable-cta') {
      event.preventDefault();
      performExit(actionNode.getAttribute('data-product-url') || '');
      return;
    }

    if (action === 'button-select') {
      event.preventDefault();
      const widgetId = actionNode.getAttribute('data-widget-id') || '';
      const kind = actionNode.getAttribute('data-button-kind') || 'primary';
      const root = getWidgetRoot(widgetId, '.widget-buttons');
      if (root) {
        root.querySelectorAll<HTMLElement>('[data-smx-action="button-select"]').forEach((button) => {
          const isActive = button === actionNode;
          if (button.getAttribute('data-button-kind') === 'primary') {
            button.style.background = isActive ? '#ffffff' : '';
            button.style.color = '#111827';
          } else {
            button.style.background = isActive ? 'rgba(255,255,255,.16)' : 'transparent';
            button.style.color = '#ffffff';
          }
        });
      }
      performExit(resolveExitUrl(widgetId));
      if (kind === 'secondary' && runtimeModel.scenes.length > 1) sceneManager.nextScene();
      return;
    }

    if (action === 'hotspot-toggle') {
      event.preventDefault();
      const widgetId = actionNode.getAttribute('data-widget-id') || '';
      const root = getWidgetRoot(widgetId, '.widget-interactive-hotspot') as HotspotRoot | null;
      if (root) toggleHotspot(root);
      return;
    }

    if (action === 'speed-test-start') {
      event.preventDefault();
      if (!actionNode.getAttribute('data-original-label')) {
        actionNode.setAttribute('data-original-label', actionNode.textContent || 'Start test');
      }
      const widgetId = actionNode.getAttribute('data-widget-id') || '';
      const root = getWidgetRoot(widgetId, '.widget-speed-test');
      if (root) runSpeedTest(root, speedTestRafs);
    }
  };

  const handleInput = (event: Event): void => {
    if (!isHTMLElement(event.target)) return;
    const rangeNode = event.target.closest<HTMLElement>('[data-smx-action="range-update"]');
    if (rangeNode && rangeNode instanceof HTMLInputElement) {
      const root = rangeNode.closest<HTMLElement>('[data-widget-id]');
      const valueLabel = root?.querySelector<HTMLElement>('[data-range-value]');
      if (valueLabel) {
        const prefix = valueLabel.textContent?.split(':')[0] || 'Value';
        valueLabel.textContent = `${prefix}: ${rangeNode.value}${rangeNode.getAttribute('data-units') || ''}`;
      }
    }

    const formNode = event.target.closest<HTMLElement>('.widget-form[data-widget-id]');
    if (formNode && (event.target.matches('[data-form-input]') || event.target.matches('[data-form-consent]'))) {
      scheduleDraft(formNode as FormRoot, 650);
    }
  };

  const handleChange = (event: Event): void => {
    if (!isHTMLElement(event.target)) return;
    const formNode = event.target.closest<HTMLElement>('.widget-form[data-widget-id]');
    if (formNode && (event.target.matches('[data-form-input]') || event.target.matches('[data-form-consent]'))) {
      scheduleDraft(formNode as FormRoot, 200);
    }
  };

  const handleSubmit = (event: SubmitEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const formRoot = target.closest<HTMLElement>('.widget-form[data-widget-id]');
    if (!formRoot) return;
    event.preventDefault();
    void submitForm(formRoot as FormRoot);
  };

  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  document.addEventListener('submit', handleSubmit);

  document.querySelectorAll<HTMLElement>('.widget-image-carousel[data-widget-id]').forEach((root) => {
    applyCarouselIndex(root, Number(root.getAttribute('data-carousel-index') || 0));
  });

  document.querySelectorAll<HTMLElement>('.widget-shoppable-sidebar[data-widget-id]').forEach((root) => {
    const products = parseJsonAttribute<ShoppableProduct[]>(root, 'data-shoppable-products', []);
    const autoscroll = root.getAttribute('data-shoppable-autoscroll') === 'true';
    const intervalMs = Math.max(1000, Number(root.getAttribute('data-shoppable-interval') || 2600));
    if (!Array.isArray(products) || products.length <= 1 || !autoscroll) return;
    const intervalId = window.setInterval(() => {
      const currentIndex = Number(root.getAttribute('data-shoppable-index') || 0);
      applyShoppableIndex(root, currentIndex + 1);
    }, intervalMs);
    shoppableIntervals.add(intervalId);
  });

  return {
    dispose() {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('input', handleInput);
      document.removeEventListener('change', handleChange);
      document.removeEventListener('submit', handleSubmit);
      disposeDragRuntime();
      shoppableIntervals.forEach((intervalId) => window.clearInterval(intervalId));
      shoppableIntervals.clear();
      speedTestRafs.forEach((rafId) => window.cancelAnimationFrame(rafId));
      speedTestRafs.clear();
      document.querySelectorAll<FormRoot>('.widget-form[data-widget-id]').forEach((root) => {
        if (!root.__smxDraftTimer) return;
        window.clearTimeout(root.__smxDraftTimer);
        root.__smxDraftTimer = 0;
      });
      document.querySelectorAll<HotspotRoot>('.widget-interactive-hotspot[data-widget-id]').forEach((root) => {
        if (!root.__smxHotspotTimer) return;
        window.clearTimeout(root.__smxHotspotTimer);
        root.__smxHotspotTimer = 0;
      });
    },
  };
}
