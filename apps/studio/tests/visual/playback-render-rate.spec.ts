import { expect, test } from '@playwright/test';
import { addWidget, openEditor } from './helpers/setup';

test('playback react syncs stay under 25 in 5 seconds', async ({ page }) => {
  await openEditor(page);
  await addWidget(page, 'text');

  await page.evaluate(() => {
    window.__studioPlaybackAudit = { reactSyncCount: 0 };
  });

  const playButton = page.getByRole('button', { name: 'Play' });
  await expect(playButton).toBeVisible();
  await playButton.click();
  await page.waitForTimeout(5000);

  const reactSyncCount = await page.evaluate(() => window.__studioPlaybackAudit?.reactSyncCount ?? 0);
  expect(reactSyncCount).toBeLessThanOrEqual(25);
});
