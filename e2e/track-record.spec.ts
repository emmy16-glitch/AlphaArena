import { expect, test } from '@playwright/test';
import { mockApi } from './mockApi';

test('track record empty state invites the first paper battle', async ({ page }) => {
  await mockApi(page, { trackRecord: 'empty' });
  await page.goto('/#/track-record');
  await expect(page.getByText('No settled battles yet')).toBeVisible();
  await expect(page.getByText('Your record starts with your first settled battle.')).toBeVisible();
  await page.getByRole('button', { name: /Open Arena/i }).click();
  await expect(page).toHaveURL(/#\/arena$/);
});

test('track record withholds scores on too little history', async ({ page }) => {
  await mockApi(page, { trackRecord: 'insufficient' });
  await page.goto('/#/track-record');
  await expect(page.getByText('Not enough history yet')).toBeVisible();
  await expect(page.getByText(/Scores unlock at 5/)).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Calibration error');
  await expect(page.getByRole('button', { name: /Record another battle/i })).toBeVisible();
});

test('track record shows win rate, Brier score and calibration curve', async ({ page }) => {
  await mockApi(page, { trackRecord: 'populated' });
  await page.goto('/#/track-record');
  await expect(page.getByText('Paper win rate')).toBeVisible();
  await expect(page.getByText('Calibration error (Brier)')).toBeVisible();
  await expect(page.getByText('Calibration curve')).toBeVisible();
  await expect(page.getByRole('img', { name: /Calibration curve/i })).toBeVisible();
  await expect(page.getByText('60–70%')).toBeVisible();
  await expect(page.getByText(/not proof of a repeatable edge/i)).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Traceback|localhost:8000|ECONN/);
});

test('track record is reachable from the main navigation', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/pulse');
  const navigation = page.getByRole('navigation', { name: /Main navigation|Mobile navigation/ });
  await navigation.getByRole('link', { name: 'Record', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/track-record$/);
  await expect(page.getByText(/Is your confidence/)).toBeVisible();
});
