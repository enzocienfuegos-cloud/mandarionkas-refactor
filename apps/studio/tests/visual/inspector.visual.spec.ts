import { expect, test } from '@playwright/test';
import { addWidget, openDocumentDataTab, openEditor } from './helpers/setup';

test('brand kit drawer baseline', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Brand Kit' }).click();
  await expect(page.locator('.brand-kit-drawer-card')).toHaveScreenshot('inspector-brand-kit-drawer.png');
});

test('variant rules document panel baseline', async ({ page }) => {
  await openEditor(page);
  await openDocumentDataTab(page);
  await expect(page.locator('.right-inspector')).toHaveScreenshot('inspector-variant-rules-panel.png');
});

test('widget inspector baseline', async ({ page }) => {
  await openEditor(page);
  await addWidget(page, 'text');
  await expect(page.locator('.right-inspector')).toHaveScreenshot('inspector-text-widget-panel.png');
});
