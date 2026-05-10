import { expect, test } from '@playwright/test';
import { openEditor } from './helpers/setup';

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`topbar clusters do not overlap @ ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openEditor(page);

    const center = await page.locator('.top-bar-center').boundingBox();
    const right = await page.locator('.top-actions-cluster').boundingBox();

    expect(center).not.toBeNull();
    expect(right).not.toBeNull();
    const horizontalOverlap = Math.min((center?.x ?? 0) + (center?.width ?? 0), (right?.x ?? 0) + (right?.width ?? 0)) - Math.max(center?.x ?? 0, right?.x ?? 0);
    const verticalOverlap = Math.min((center?.y ?? 0) + (center?.height ?? 0), (right?.y ?? 0) + (right?.height ?? 0)) - Math.max(center?.y ?? 0, right?.y ?? 0);
    expect(horizontalOverlap > 0 && verticalOverlap > 0).toBe(false);
  });
}
