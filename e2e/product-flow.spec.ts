import { expect, test } from '@playwright/test';
import { mockApi } from './mockApi';

test('NightWatch turns a thesis into an evidence-first result', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/nightwatch');
  await expect(page.getByText('1 · Your idea')).toBeVisible();
  await page.getByLabel('Trade thesis').fill('NVDA momentum can continue if the broad market remains supportive.');
  await page.getByRole('button', { name: /Stress-test my idea/i }).click();
  await expect(page.getByText('3 · NightWatch result')).toBeVisible();
  await expect(page.getByRole('heading', { name: /idea survives/i })).toBeVisible();
  await expect(page.getByText(/This thesis fails if/i)).toBeVisible();
  await expect(page.getByText(/bitget-live/i)).toBeVisible();
});

test('MarketTwin runs a transparent scenario with model provenance', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/lab');
  await page.getByLabel('1 · What should change?').fill('What if Nasdaq falls 5% before the U.S. open?');
  await page.getByRole('button', { name: 'Run scenario', exact: true }).click();
  await expect(page.getByText(/3 · nasdaq stress/i)).toBeVisible();
  await expect(page.getByText(/Model source: Vibe-Trading historical calibration/i)).toBeVisible();
  await expect(page.getByText(/not a forecast/i).first()).toBeVisible();
});

test('technical upstream failures are translated into human language', async ({ page }) => {
  await mockApi(page, { pulseFailure: true });
  await page.goto('/#/pulse');
  await expect(page.getByText(/Live Pulse is unavailable/i)).toBeVisible();
  await expect(page.getByText(/Try again in a moment/i)).toBeVisible();
  await expect(page.locator('body')).not.toContainText('502');
  await expect(page.locator('body')).not.toContainText('localhost:8000');
  await expect(page.locator('body')).not.toContainText('ECONN');
});

test('paper-only guardrails are visible before entering Arena', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/arena');
  await expect(page.getByText(/No deposit\. No wallet\. No real-money execution/i)).toBeVisible();
  await expect(page.getByText(/Paper-only guardrail/i)).toBeVisible();
  await expect(page.getByText(/Virtual net value/i)).toBeVisible();
  await expect(page.getByText('$100,000', { exact: false }).first()).toBeVisible();
});
