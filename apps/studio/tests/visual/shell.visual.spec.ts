import { expect, test } from '@playwright/test';
import { gotoStudio, loginToStudio, openClientWorkspace } from './helpers/setup';

test('login screen baseline', async ({ page }) => {
  await gotoStudio(page);
  await expect(page).toHaveScreenshot('shell-login-screen.png', { fullPage: true });
});

test('agency shell baseline', async ({ page }) => {
  await loginToStudio(page);
  await expect(page).toHaveScreenshot('shell-agency-command-center.png', { fullPage: true });
});

test('client workspace onboarding baseline', async ({ page }) => {
  await openClientWorkspace(page);
  await expect(page).toHaveScreenshot('shell-client-workspace-onboarding.png', { fullPage: true });
});
