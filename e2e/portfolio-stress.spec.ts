import { expect, test } from '@playwright/test';
import { mockApi } from './mockApi';

test('a 3-position paper portfolio runs one combined stress scenario', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/lab');
  await expect(page.getByText('Stress several paper positions at once.')).toBeVisible();

  await page.getByRole('button', { name: /Add position/i }).click();
  await expect(page.getByLabel('Position 3 symbol')).toBeVisible();
  await page.getByLabel('Position 3 symbol').selectOption('rTSLA');
  await page.getByRole('button', { name: 'SHORT', exact: true }).nth(2).click();
  await page.getByLabel('Position 3 stake').fill('5000');

  await page.getByRole('button', { name: /Run portfolio stress test/i }).click();
  await expect(page.getByText(/Portfolio aggregate/i)).toBeVisible();
  await expect(page.getByText('-$302.50').first()).toBeVisible();
  await expect(page.getByText(/stake-weighted sum of leg impacts/i).first()).toBeVisible();

  const legButtons = page.getByRole('button', { name: /Show leg work/i });
  await expect(legButtons).toHaveCount(3);
  await legButtons.first().click();
  await expect(page.getByText(/based on 60 aligned historical observations/i).first()).toBeVisible();
  await page.getByText('Show your work', { exact: true }).click();
  await expect(page.getByText(/only 7 of the required 20 paired observations/i).first()).toBeVisible();
});
