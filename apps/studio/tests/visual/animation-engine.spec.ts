import { expect, test, type FrameLocator, type Locator, type Page } from '@playwright/test';

type MotionHost = Pick<Page, 'locator'> | FrameLocator;

async function openScenario(page: Page, scenario: string): Promise<void> {
  await page.goto(`/animation-engine-visual.html?scenario=${encodeURIComponent(scenario)}`);
}

async function captureMilestones(
  page: Page,
  target: Locator,
  snapshotPrefix: string,
): Promise<void> {
  await expect(target).toHaveScreenshot(`${snapshotPrefix}-0ms.png`);
  await page.waitForTimeout(200);
  await expect(target).toHaveScreenshot(`${snapshotPrefix}-200ms.png`);
  await page.waitForTimeout(500);
  await expect(target).toHaveScreenshot(`${snapshotPrefix}-700ms.png`);
}

async function scratchReveal(page: Page, host: MotionHost, selector = '[data-scratch-canvas]'): Promise<void> {
  const canvas = host.locator(selector).first();
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Scratch canvas bounds not available');
  const startX = bounds.x + 20;
  const endX = bounds.x + bounds.width - 20;
  const centerY = bounds.y + bounds.height / 2;
  await page.mouse.move(startX, centerY);
  await page.mouse.down();
  await page.mouse.move(endX, centerY, { steps: 24 });
  await page.mouse.move(startX, bounds.y + bounds.height * 0.72, { steps: 24 });
  await page.mouse.move(endX, bounds.y + bounds.height * 0.28, { steps: 24 });
  await page.mouse.up();
}

test('load-triggered enter motion starts at local zero even with a late timeline start', async ({ page }) => {
  await openScenario(page, 'load-local-zero');
  await expect(page.locator('.banner-shell')).toBeVisible();
  await captureMilestones(page, page.locator('.banner-shell'), 'animation-engine-load-local-zero');
});

test('timeline-triggered enter motion waits for the widget absolute start time', async ({ page }) => {
  await openScenario(page, 'timeline-start');
  await expect(page.locator('.banner-shell')).toBeVisible();
  await captureMilestones(page, page.locator('.banner-shell'), 'animation-engine-timeline-start');
  await page.waitForTimeout(1500);
  await expect(page.locator('.banner-shell')).toHaveScreenshot('animation-engine-timeline-start-2200ms.png');
});

test('reveal-triggered idle motion stays parked until scratch completes and then starts looping', async ({ page }) => {
  await openScenario(page, 'reveal-idle');
  await expect(page.locator('.banner-shell')).toBeVisible();
  await scratchReveal(page, page);
  await captureMilestones(page, page.locator('.banner-shell'), 'animation-engine-reveal-idle');
});

test('scratch reveal can stagger multiple reveal-triggered widgets from the same completion clock', async ({ page }) => {
  await openScenario(page, 'scratch-stagger');
  await expect(page.locator('.banner-shell')).toBeVisible();
  await scratchReveal(page, page);
  await captureMilestones(page, page.locator('.banner-shell'), 'animation-engine-scratch-stagger');
});

test('client preview and public preview stay visually aligned 200ms after reveal', async ({ page }) => {
  await openScenario(page, 'preview-parity');
  const leftFrame = page.frameLocator('iframe[data-preview="left"]');
  const rightFrame = page.frameLocator('iframe[data-preview="right"]');
  await expect(leftFrame.locator('.banner-shell')).toBeVisible();
  await expect(rightFrame.locator('.banner-shell')).toBeVisible();
  await scratchReveal(page, leftFrame);
  await scratchReveal(page, rightFrame);
  await captureMilestones(page, page.locator('.parity-grid'), 'animation-engine-preview-parity');
});

test('applying a preset keeps managed keyframes out of the widget timeline payload', async ({ page }) => {
  await openScenario(page, 'no-managed-keyframes');
  await expect(page.locator('[data-diagnostic-root]')).toBeVisible();
  await captureMilestones(page, page.locator('[data-diagnostic-root]'), 'animation-engine-no-managed-keyframes');
});

test('public preview keeps the scratch mask target visible after reveal instead of hiding the container', async ({ page }) => {
  await openScenario(page, 'scratch-visible');
  await expect(page.locator('.banner-shell')).toBeVisible();
  await scratchReveal(page, page);
  await captureMilestones(page, page.locator('.banner-shell'), 'animation-engine-scratch-visible');
  await expect(page.locator('[data-scratch-mask-target]')).not.toHaveCSS('display', 'none');
});

test('restart replay policy cancels the first click animation and restarts from local zero', async ({ page }) => {
  await openScenario(page, 'replay-restart');
  await expect(page.locator('.banner-shell')).toBeVisible();
  const cta = page.locator('[data-widget-id="restart_cta"]');
  await cta.click();
  await page.waitForTimeout(300);
  await cta.click();
  await captureMilestones(page, page.locator('.banner-shell'), 'animation-engine-replay-restart');
});

test('ignore replay policy keeps the current click animation running on repeated clicks', async ({ page }) => {
  await openScenario(page, 'replay-ignore');
  await expect(page.locator('.banner-shell')).toBeVisible();
  const cta = page.locator('[data-widget-id="ignore_cta"]');
  await cta.click();
  await page.waitForTimeout(300);
  await cta.click();
  await captureMilestones(page, page.locator('.banner-shell'), 'animation-engine-replay-ignore');
});

test('legacy motion normalization preserves the exported visual behavior against the slot-based model', async ({ page }) => {
  await openScenario(page, 'legacy-parity');
  await expect(page.frameLocator('iframe[data-preview="left"]').locator('.banner-shell')).toBeVisible();
  await expect(page.frameLocator('iframe[data-preview="right"]').locator('.banner-shell')).toBeVisible();
  await captureMilestones(page, page.locator('.parity-grid'), 'animation-engine-legacy-parity');
});
