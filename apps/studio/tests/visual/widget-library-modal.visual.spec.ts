import { expect, test } from '@playwright/test';
import { openEditor } from './helpers/setup';

test('widget library popover baseline', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Widget' }).click();
  await expect(page.locator('.top-widget-library-popover')).toHaveScreenshot('widget-library-popover.png');
});
