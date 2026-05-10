import { expect, test } from '@playwright/test';
import { addWidget, openEditor } from './helpers/setup';

test('timeline baseline on empty editor', async ({ page }) => {
  await openEditor(page);
  await expect(page.locator('.bottom-timeline')).toHaveScreenshot('timeline-empty-editor.png');
});

test('timeline baseline with seeded widgets', async ({ page }) => {
  await openEditor(page);
  await addWidget(page, 'text');
  await addWidget(page, 'cta');
  await expect(page.locator('.bottom-timeline')).toHaveScreenshot('timeline-with-widgets.png');
});
