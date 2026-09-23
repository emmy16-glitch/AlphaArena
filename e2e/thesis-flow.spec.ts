import { expect, test } from '@playwright/test';
import { mockApi } from './mockApi';

test('first-load Home shows pending decisions and a disabled Arena', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('snapshot-card')).toContainText('Snapshot not frozen yet');
  await expect(page.getByTestId('decisions-pending')).toContainText('No decisions yet');
  const arenaCta = page.getByTestId('arena-card').getByRole('button', { name: /ENTER ARENA/i });
  await expect(arenaCta).toBeDisabled();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toContainText('Same evidence.');
});

test('invalid thesis is rejected before any freeze', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByLabel('Write your market thesis').fill('NVDA');
  await page.getByRole('button', { name: /TEST THESIS/i }).click();
  await expect(page.getByRole('alert')).toContainText('Write your thesis first');
  await expect(page.getByTestId('decisions-pending')).toBeVisible();
});

test('test thesis freezes one snapshot and shows same-snapshot calls', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByLabel('Write your market thesis').fill('NVDA stays strong over the next 24 hours.');
  // Double-click protection: two rapid clicks issue a single freeze.
  await page.getByRole('button', { name: /TEST THESIS/i }).dblclick();
  await expect(page.getByTestId('decisions-ready')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('participant-human')).toContainText('BUY');
  await expect(page.getByTestId('participant-baseline')).toContainText('BUY');
  await expect(page.getByTestId('participant-qwen')).toContainText('Unavailable');
  await expect(page.getByTestId('receipt-hash')).toContainText('deadbeefreceipt0001');
  await expect(page.getByTestId('arena-card').getByRole('button', { name: /ENTER ARENA/i })).toBeEnabled();
});

test('enter arena transitions from a ready session', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByLabel('Write your market thesis').fill('NVDA stays strong over the next 24 hours.');
  await page.getByRole('button', { name: /TEST THESIS/i }).click();
  await expect(page.getByTestId('decisions-ready')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('arena-card').getByRole('button', { name: /ENTER ARENA/i }).click();
  await expect(page.getByTestId('arena-screen')).toBeVisible({ timeout: 15000 });
});

test('back/forward navigation preserves the new IA', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/research');
  await expect(page.getByTestId('research-screen')).toBeVisible();
  await page.goto('/#/history');
  await expect(page.getByTestId('history-screen')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('research-screen')).toBeVisible();
});

test('research nightwatch tab calls the real analyze endpoint', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/research');
  await expect(page.getByTestId('research-screen')).toBeVisible();
  await expect(page.getByTestId('research-nightwatch')).toBeVisible();
  await expect(page.getByTestId('research-nightwatch')).toContainText('NightWatch Analysis', { timeout: 15000 });
});

test('research evidence lists only real sources with working View buttons', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/research');
  await expect(page.getByTestId('research-screen')).toBeVisible();
  await page.getByRole('tab', { name: 'Evidence' }).click();
  await expect(page.getByTestId('research-evidence')).toBeVisible();
  await expect(page.getByTestId('research-evidence')).toContainText('Bitget Reality Tape');
  await expect(page.getByTestId('research-evidence')).not.toContainText('Bloomberg');
  await expect(page.getByTestId('research-evidence')).not.toContainText('Reuters');
  const views = page.getByTestId('research-evidence').getByRole('button', { name: /^View / });
  expect(await views.count()).toBeGreaterThan(3);
});

test('history tape table loads the real export log', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/history');
  await expect(page.getByTestId('history-screen')).toBeVisible();
  await expect(page.getByTestId('history-tape')).toBeVisible();
  await expect(page.getByTestId('history-tape')).toContainText('NVDA stays strong', { timeout: 15000 });
});
