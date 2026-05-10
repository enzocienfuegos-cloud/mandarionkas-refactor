import { expect, test } from '@playwright/test';
import { openEditor } from './helpers/setup';

test('asset library modal baseline', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Assets' }).click();
  await expect(page.locator('.asset-library-browser')).toHaveScreenshot('asset-library-modal.png');
});
