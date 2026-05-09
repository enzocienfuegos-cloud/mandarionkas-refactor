import { expect, test } from '@playwright/test';
import { openEditor, openExportMenu, openPreflightTray } from './helpers/setup';

test('export menu baseline', async ({ page }) => {
  await openEditor(page);
  await openExportMenu(page);
  await expect(page.locator('.top-bar')).toHaveScreenshot('export-menu-open.png');
});

test('preflight tray baseline', async ({ page }) => {
  await openEditor(page);
  await openPreflightTray(page);
  await expect(page.locator('.preflight-tray')).toHaveScreenshot('export-preflight-tray.png');
});

test('export menu with preflight open baseline', async ({ page }) => {
  await openEditor(page);
  await openPreflightTray(page);
  await openExportMenu(page);
  await expect(page).toHaveScreenshot('export-menu-and-preflight.png', { fullPage: true });
});
