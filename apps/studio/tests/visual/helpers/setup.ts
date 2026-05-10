import { expect, type Page } from '@playwright/test';
import { installMockServer } from './mock-server';

const MOTION_RESET = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }
`;

export async function disableMotion(page: Page): Promise<void> {
  await page.addStyleTag({ content: MOTION_RESET });
}

export async function gotoStudio(page: Page, hash = '/#/hub'): Promise<void> {
  await installMockServer(page);
  await page.goto(hash);
  await page.waitForLoadState('networkidle');
  await disableMotion(page);
}

export async function loginToStudio(page: Page): Promise<void> {
  await gotoStudio(page);
  await expect(page.locator('.platform-login-shell')).toBeVisible();
  await page.getByRole('button', { name: 'Enter platform' }).click();
  await expect(page.getByRole('heading', { name: 'Agency hub' })).toBeVisible();
  await disableMotion(page);
}

export async function openClientWorkspace(page: Page): Promise<void> {
  await loginToStudio(page);
  await page.goto('/#/hub/client/ws_retail');
  await expect(page.getByRole('heading', { name: 'Retail Group' })).toBeVisible();
  await disableMotion(page);
}

export async function openEditor(page: Page): Promise<void> {
  await openClientWorkspace(page);
  await page.getByRole('tab', { name: 'Templates' }).click();
  const blankCanvasButton = page.getByRole('button', { name: /Blank canvas/i }).first();
  await expect(blankCanvasButton).toBeVisible();
  await blankCanvasButton.click();
  await expect(page.locator('.studio-shell')).toBeVisible();
  await expect(page.getByLabel('Go back to workspace')).toBeVisible();
  await page.waitForTimeout(250);
  await disableMotion(page);
}

export async function addWidget(page: Page, widgetType: string): Promise<void> {
  const widgetTrigger = page.getByRole('button', { name: /^Widget$/ });
  await expect(widgetTrigger).toBeVisible();
  await widgetTrigger.click();
  await expect(page.locator('.top-widget-library-popover')).toBeVisible();
  await page.locator(`[data-widget-type="${widgetType}"]`).click();
  await page.waitForTimeout(150);
}

export async function openDocumentDataTab(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Data' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Brand kit');
}

export async function openExportMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Export / }).click();
  await expect(page.getByRole('menu', { name: 'Export format' })).toBeVisible();
}

export async function openPreflightTray(page: Page): Promise<void> {
  const toggle = page.locator('.preflight-tray__toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('.preflight-tray__panel')).toBeVisible();
}
