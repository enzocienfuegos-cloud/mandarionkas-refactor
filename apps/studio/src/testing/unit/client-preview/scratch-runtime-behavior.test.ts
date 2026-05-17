import { afterAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { createInitialState } from '../../../domain/document/factories';
import { buildClientPreviewSceneHtml } from '../../../features/client-preview/ClientPreviewPlayer';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  browser ??= await chromium.launch();
  return browser;
}

afterAll(async () => {
  await browser?.close();
  browser = null;
});

describe('scratch reveal runtime behavior', () => {
  it('replays compositor motion on a selected target group child after scratch completion', async () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.canvas = { width: 300, height: 250, backgroundColor: '#111827' };
    state.document.metadata.release.targetChannel = 'generic-html5';
    state.document.widgets.target_group = {
      id: 'target_group',
      type: 'group',
      name: 'Target group',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 300, height: 250, rotation: 0 },
      style: {},
      props: { title: 'Target group' },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
      childIds: ['image_1'],
    } as any;
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Animated child',
      sceneId,
      parentId: 'target_group',
      zIndex: 2,
      frame: { x: 40, y: 55, width: 120, height: 90, rotation: 0 },
      style: { opacity: 1 },
      props: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'Animated child' },
      motion: {
        templateId: 'slide-in-left',
        config: { durationMs: 900, delayMs: 0, distancePx: 80 },
      },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
    } as any;
    state.document.widgets.scratch_group = {
      id: 'scratch_group',
      type: 'group',
      name: 'Scratch cover',
      sceneId,
      zIndex: 5,
      frame: { x: 0, y: 0, width: 300, height: 250, rotation: 0 },
      style: { accentColor: '#ffffff', borderRadius: 0, opacity: 1 },
      props: {
        title: 'Scratch cover',
        scratchEnabled: true,
        scratchRadius: 80,
        autoRevealThresholdPercent: 1,
        activationDelayMs: 0,
        revealTargetMode: 'widget',
        revealTargetId: 'target_group',
      },
      timeline: { startMs: 0, endMs: 1000 },
      childIds: [],
    } as any;
    state.document.scenes[0].widgetIds.push('target_group', 'image_1', 'scratch_group');

    const html = buildClientPreviewSceneHtml(state, 0);
    const page = await (await getBrowser()).newPage({ viewport: { width: 360, height: 320 } });

    try {
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForSelector('[data-scratch-canvas]');

      const before = await page.evaluate(() => ({
        ready: typeof (window as any).smxInitCompositorMotion === 'function',
        completed: Boolean((window as any).__smxScratchCompletionMsByWidgetId?.scratch_group),
        childAnimations: document.querySelector('[data-widget-layer-id="image_1"]')?.getAnimations().length ?? -1,
      }));
      expect(before.ready).toBe(true);
      expect(before.completed).toBe(false);
      expect(before.childAnimations).toBe(0);

      await page.evaluate(() => {
        const canvas = document.querySelector('[data-scratch-canvas]');
        if (!canvas) throw new Error('missing scratch canvas');
        const rect = canvas.getBoundingClientRect();
        const dispatch = (type: string, x: number, y: number) => {
          canvas.dispatchEvent(new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + x,
            clientY: rect.top + y,
            pointerId: 1,
            pointerType: 'mouse',
          }));
        };
        dispatch('pointerdown', 20, 20);
        for (let x = 20; x <= rect.width - 20; x += 24) {
          dispatch('pointermove', x, rect.height / 2);
        }
        dispatch('pointerup', rect.width - 20, rect.height / 2);
      });

      await page.waitForFunction(() => Boolean((window as any).__smxScratchCompletionMsByWidgetId?.scratch_group), null, { timeout: 1000 });
      const after = await page.evaluate(() => {
        const layer = document.querySelector('[data-widget-layer-id="image_1"]');
        const widget = document.querySelector('[data-widget-id="image_1"]');
        return {
          childLayerAnimations: layer?.getAnimations().length ?? -1,
          childWidgetAnimations: widget?.getAnimations().length ?? -1,
          completed: Boolean((window as any).__smxScratchCompletionMsByWidgetId?.scratch_group),
        };
      });

      expect(after.completed).toBe(true);
      expect(after.childLayerAnimations + after.childWidgetAnimations).toBeGreaterThan(0);
    } finally {
      await page.close();
    }
  }, 10000);

  it('replays compositor motion applied to the selected target group on its visible child layers', async () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.canvas = { width: 300, height: 250, backgroundColor: '#111827' };
    state.document.metadata.release.targetChannel = 'generic-html5';
    state.document.widgets.target_group = {
      id: 'target_group',
      type: 'group',
      name: 'Target group',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 300, height: 250, rotation: 0 },
      style: {},
      props: { title: 'Target group' },
      motion: {
        templateId: 'slide-in-left',
        config: { durationMs: 900, delayMs: 0, distancePx: 80 },
      },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
      childIds: ['image_1'],
    } as any;
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Grouped child',
      sceneId,
      parentId: 'target_group',
      zIndex: 2,
      frame: { x: 40, y: 55, width: 120, height: 90, rotation: 0 },
      style: { opacity: 1 },
      props: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'Grouped child' },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
    } as any;
    state.document.widgets.scratch_group = {
      id: 'scratch_group',
      type: 'group',
      name: 'Scratch cover',
      sceneId,
      zIndex: 5,
      frame: { x: 0, y: 0, width: 300, height: 250, rotation: 0 },
      style: { accentColor: '#ffffff', borderRadius: 0, opacity: 1 },
      props: {
        title: 'Scratch cover',
        scratchEnabled: true,
        scratchRadius: 80,
        autoRevealThresholdPercent: 1,
        activationDelayMs: 0,
        revealTargetMode: 'widget',
        revealTargetId: 'target_group',
      },
      timeline: { startMs: 0, endMs: 1000 },
      childIds: [],
    } as any;
    state.document.scenes[0].widgetIds.push('target_group', 'image_1', 'scratch_group');

    const html = buildClientPreviewSceneHtml(state, 0);
    const page = await (await getBrowser()).newPage({ viewport: { width: 360, height: 320 } });

    try {
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForSelector('[data-scratch-canvas]');

      await page.evaluate(() => {
        const canvas = document.querySelector('[data-scratch-canvas]');
        if (!canvas) throw new Error('missing scratch canvas');
        const rect = canvas.getBoundingClientRect();
        const dispatch = (type: string, x: number, y: number) => {
          canvas.dispatchEvent(new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + x,
            clientY: rect.top + y,
            pointerId: 1,
            pointerType: 'mouse',
          }));
        };
        dispatch('pointerdown', 20, 20);
        for (let x = 20; x <= rect.width - 20; x += 24) {
          dispatch('pointermove', x, rect.height / 2);
        }
        dispatch('pointerup', rect.width - 20, rect.height / 2);
      });

      await page.waitForFunction(() => Boolean((window as any).__smxScratchCompletionMsByWidgetId?.scratch_group), null, { timeout: 1000 });
      const after = await page.evaluate(() => {
        const layer = document.querySelector('[data-widget-layer-id="image_1"]');
        return {
          childLayerAnimations: layer?.getAnimations().length ?? -1,
          completed: Boolean((window as any).__smxScratchCompletionMsByWidgetId?.scratch_group),
        };
      });

      expect(after.completed).toBe(true);
      expect(after.childLayerAnimations).toBeGreaterThan(0);
    } finally {
      await page.close();
    }
  }, 10000);

  it('replays timeline-managed keyframes from local zero after scratch reveal even with a late widget start', async () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.canvas = { width: 300, height: 250, backgroundColor: '#111827' };
    state.document.metadata.release.targetChannel = 'generic-html5';
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Late timeline child',
      sceneId,
      zIndex: 1,
      frame: { x: 40, y: 55, width: 120, height: 90, rotation: 0 },
      style: { opacity: 1 },
      props: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'Late timeline child' },
      timeline: {
        startMs: 5000,
        endMs: 6000,
        keyframes: [
          { id: 'opacity-start', property: 'opacity', atMs: 5000, value: 0, easing: 'linear' },
          { id: 'opacity-end', property: 'opacity', atMs: 5200, value: 1, easing: 'linear' },
        ],
      },
    } as any;
    state.document.widgets.scratch_group = {
      id: 'scratch_group',
      type: 'group',
      name: 'Scratch cover',
      sceneId,
      zIndex: 5,
      frame: { x: 0, y: 0, width: 300, height: 250, rotation: 0 },
      style: { accentColor: '#ffffff', borderRadius: 0, opacity: 1 },
      props: {
        title: 'Scratch cover',
        scratchEnabled: true,
        scratchRadius: 80,
        autoRevealThresholdPercent: 1,
        activationDelayMs: 0,
        revealTargetMode: 'widget',
        revealTargetId: 'image_1',
      },
      timeline: { startMs: 0, endMs: 1000 },
      childIds: [],
    } as any;
    state.document.scenes[0].widgetIds.push('image_1', 'scratch_group');

    const html = buildClientPreviewSceneHtml(state, 0);
    const page = await (await getBrowser()).newPage({ viewport: { width: 360, height: 320 } });

    try {
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForSelector('[data-scratch-canvas]');

      const beforeOpacity = await page.evaluate(() => {
        const node = document.querySelector('[data-widget-id="image_1"]') as HTMLElement | null;
        return node ? Number(window.getComputedStyle(node).opacity) : -1;
      });
      expect(beforeOpacity).toBe(0);

      await page.evaluate(() => {
        const canvas = document.querySelector('[data-scratch-canvas]');
        if (!canvas) throw new Error('missing scratch canvas');
        const rect = canvas.getBoundingClientRect();
        const dispatch = (type: string, x: number, y: number) => {
          canvas.dispatchEvent(new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + x,
            clientY: rect.top + y,
            pointerId: 1,
            pointerType: 'mouse',
          }));
        };
        dispatch('pointerdown', 20, 20);
        for (let x = 20; x <= rect.width - 20; x += 24) {
          dispatch('pointermove', x, rect.height / 2);
        }
        dispatch('pointerup', rect.width - 20, rect.height / 2);
      });

      await page.waitForFunction(() => Boolean((window as any).__smxScratchCompletionPerfMsByWidgetId?.scratch_group), null, { timeout: 1000 });
      await page.waitForFunction(() => {
        const node = document.querySelector('[data-widget-id="image_1"]');
        return node ? Number(window.getComputedStyle(node).opacity) > 0.9 : false;
      }, null, { timeout: 1000 });

      const after = await page.evaluate(() => {
        const node = document.querySelector('[data-widget-id="image_1"]') as HTMLElement | null;
        return {
          completed: Boolean((window as any).__smxScratchCompletionMsByWidgetId?.scratch_group),
          completedPerf: Boolean((window as any).__smxScratchCompletionPerfMsByWidgetId?.scratch_group),
          opacity: node ? Number(window.getComputedStyle(node).opacity) : -1,
        };
      });

      expect(after.completed).toBe(true);
      expect(after.completedPerf).toBe(true);
      expect(after.opacity).toBeGreaterThan(0.9);
    } finally {
      await page.close();
    }
  }, 10000);
});
