import { expect, test } from '@playwright/test';
import { openEditor } from './helpers/setup';

test('widget library modal baseline', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Browse all widgets' }).click();
  await expect(page.locator('.widget-library-modal')).toHaveScreenshot('widget-library-modal.png');
});
