import { expect, test } from '@playwright/test';
import { addWidget, openEditor } from './helpers/setup';

test('blank editor stage baseline', async ({ page }) => {
  await openEditor(page);
  await expect(page.locator('.workspace')).toHaveScreenshot('stage-blank-editor.png');
});

test('text widget stage baseline', async ({ page }) => {
  await openEditor(page);
  await addWidget(page, 'text');
  await expect(page.locator('.workspace')).toHaveScreenshot('stage-text-widget.png');
});

test('cta widget stage baseline', async ({ page }) => {
  await openEditor(page);
  await addWidget(page, 'cta');
  await expect(page.locator('.workspace')).toHaveScreenshot('stage-cta-widget.png');
});

test('qr code widget stage baseline', async ({ page }) => {
  await openEditor(page);
  await addWidget(page, 'qr-code');
  await expect(page.locator('.workspace')).toHaveScreenshot('stage-qr-code-widget.png');
});
