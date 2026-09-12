import { expect, test } from '@playwright/test';
import { mockApi } from './mockApi';

async function runLabScenario(page) {
  await page.goto('/#/lab');
  await page.getByRole('button', { name: 'Run scenario from prompt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What this scenario means' })).toBeVisible();
}

test('Show your work states the prior fallback below 20 paired observations', async ({ page }) => {
  await mockApi(page, { twinFallback: true });
  await runLabScenario(page);
  await page.getByText('Show your work', { exact: true }).click();
  await expect(page.getByText(/only 7 of the required 20 paired observations/i).first()).toBeVisible();
  await expect(page.getByText(/transparent AlphaArena prior/i).first()).toBeVisible();
  await page.getByRole('button', { name: /View why Nvidia has this estimate/i }).click();
  await expect(page.getByText(/historical beta wasn.?t used/i).first()).toBeVisible();
});

test('Show your work reports measured beta inputs when calibrated', async ({ page }) => {
  await mockApi(page);
  await runLabScenario(page);
  await page.getByText('Show your work', { exact: true }).click();
  await expect(page.getByText(/based on 60 aligned historical observations/i).first()).toBeVisible();
  await expect(page.getByText(/beta of 1\.10 to QQQ/i).first()).toBeVisible();
});
