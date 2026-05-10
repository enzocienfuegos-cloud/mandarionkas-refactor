import { expect, test } from '@playwright/test';
import { openEditor } from './helpers/setup';

test('editor topbar baseline at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await openEditor(page);
  await expect(page.locator('.top-bar-ux')).toHaveScreenshot('topbar-1440.png');
});

test('editor topbar baseline at 1280', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openEditor(page);
  await expect(page.locator('.top-bar-ux')).toHaveScreenshot('topbar-1280.png');
});
