import { expect, test } from '@playwright/test';
import { mockApi } from './mockApi';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded');
  const size = await page.evaluate(() => ({
    viewport: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll, `page scroll width ${size.scroll}px should fit viewport ${size.viewport}px`).toBeLessThanOrEqual(size.viewport + 1);
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('landing is clear and the primary action enters the product', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Don’t just watch/i })).toBeVisible();
  await expect(page.getByText('$100K', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Enter app/i }).click();
  await expect(page.getByRole('heading', { name: /What matters/i })).toBeVisible();
  await expect(page).toHaveURL(/#\/pulse$/);
  await expectNoHorizontalOverflow(page);
});

test('core screens do not overflow the viewport', async ({ page }) => {
  for (const view of ['pulse', 'lab', 'arena', 'portfolio', 'leaderboard', 'track-record', 'create']) {
    await page.goto(`/#/${view}`);
    await expect(page.locator('main')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test('mobile form controls remain readable and touch-friendly', async ({ page, isMobile }) => {
  test.skip(!isMobile && (page.viewportSize()?.width || 1000) > 600, 'mobile/narrow check');
  await page.goto('/#/nightwatch');
  const textArea = page.getByLabel('Trade thesis');
  await expect(textArea).toBeVisible();
  const fontSize = await textArea.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);

  const buttons = page.locator('button:visible');
  const count = await buttons.count();
  for (let i = 0; i < count; i += 1) {
    const box = await buttons.nth(i).boundingBox();
    if (!box) continue;
    expect(box.height, `visible button ${i} should have a usable touch height`).toBeGreaterThanOrEqual(40);
  }
  await expectNoHorizontalOverflow(page);
});

test('browser back returns to the previous AlphaArena screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Enter app/i }).click();
  const navigation = page.getByRole('navigation', { name: /Main navigation|Mobile navigation/ });
  await navigation.getByRole('link', { name: 'Lab', exact: true }).click();
  await expect(page).toHaveURL(/#\/lab$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/pulse$/);
  await expect(page.getByRole('heading', { name: /What matters/i })).toBeVisible();
});

test('reduced-motion preference removes long animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const reducedMotion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const durationSeconds = await page.locator('.fade-up').first().evaluate((element) => {
    const firstDuration = getComputedStyle(element).animationDuration.split(',')[0].trim();
    return firstDuration.endsWith('ms')
      ? Number.parseFloat(firstDuration) / 1000
      : Number.parseFloat(firstDuration);
  });
  expect(reducedMotion).toBe(true);
  expect(durationSeconds).toBeLessThanOrEqual(0.001);
});
