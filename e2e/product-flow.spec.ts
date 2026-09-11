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
  await expect(page.getByText(/What would weaken this idea/i)).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/bitget-live|Vibe-Trading|Qwen|deterministic/i);
});

test('MarketTwin runs a transparent scenario with plain-language evidence status', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/lab');
  await page.getByLabel('1 · What should change?').fill('What if Nasdaq falls 5% before the U.S. open?');
  await page.getByRole('button', { name: 'Run scenario from prompt', exact: true }).click();
  await expect(page.getByText(/3 · nasdaq stress/i)).toBeVisible();
  await expect(page.getByText(/Data and explanation status/i)).toBeVisible();
  await expect(page.getByText(/not a forecast/i).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Model source|Vibe-Trading|Qwen|bitget-live|deterministic/i);
});

test('MarketTwin progressive disclosures and challenge flow preserve the original result', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/lab');
  await page.getByRole('button', { name: 'Run scenario from prompt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What this scenario means' })).toBeVisible();
  await page.getByRole('button', { name: /View why Nvidia has this estimate/i }).click();
  await expect(page.getByText(/measured relationship with the selected benchmark/i)).toBeVisible();
  await page.getByRole('button', { name: 'Challenge this', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What would you like to challenge?' })).toBeVisible();
  await page.getByRole('button', { name: 'The historical evidence', exact: true }).click();
  await page.getByRole('button', { name: 'Test this objection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The original remains unchanged' })).toBeVisible();
  await expect(page.getByText('Original historical sensitivity')).toBeVisible();
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
  const arena = page.getByRole('main');
  await expect(arena.getByText(/No deposit\. No wallet\. No real-money execution/i)).toBeVisible();
  await expect(arena.getByText(/Virtual net value/i)).toBeVisible();
  await expect(arena.getByText('$100,000', { exact: false }).first()).toBeVisible();
});
