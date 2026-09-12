import { expect, test } from '@playwright/test';
import { mockApi } from './mockApi';

test('Shadow Session: arena form locks commitment, settled card shows bars + verbatim sentence', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/arena');
  const arena = page.getByRole('main');
  await expect(arena.getByLabel(/If I am wrong/i)).toBeVisible();
  await expect(arena.getByLabel(/Kill level percent/i)).toBeVisible();
  await arena.getByLabel(/If I am wrong/i).fill('weekend tape gaps against me');
  await arena.getByLabel('Battle thesis').fill('rNVDA momentum can survive the weekendDistinct.');
  await arena.getByRole('button', { name: /Enter the Arena/i }).click();
  await expect(page).toHaveURL(/#\/battle$/);
  await expect(page.getByText('Where the move occurred').first()).toBeVisible();
  await expect(page.getByText('You said:').first()).toBeVisible();
  await expect(page.getByText(/weekend tape gaps against me/i).first()).toBeVisible();
});

test('Shadow Session: settled battle verifies freeze and morgue shows receipt', async ({ page }) => {
  await mockApi(page);
  // Register before any navigation so the first BattleScreen fetch is deterministic.
  await page.route('**/api/arena/battles', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'battle-test', symbol: 'rNVDA', thesis: 'Test thesis', wrong_sentence: 'weekend tape gaps against me', user_side: 'LONG', ai_side: 'WAIT', opponent: 'NightWatch', stake: 10000, entry_price: 100, current_price: 97.2, user_pnl_pct: -2.8, ai_pnl_pct: 0, created_at: '2026-09-10T10:00:00Z', expires_at: '2026-09-11T10:00:00Z', settled_at: '2026-09-12T03:11:00Z', settled_price: 97.2, settlement_hash: '9f3adeadbeef0001', status: 'settled', source: 'bitget', shadow: { listed_move_pct: 0.4, shadow_move_pct: -3.2, total_move_pct: -2.8, kill_session: 'shadow', kill_at: '2026-09-12T03:11:00Z', candle_count: 24, granularity: '1H', is_estimate: true, last_listed_price: 100.4, session_label: 'Listed = NYSE hours.' }, flatten_before_dark: { flatten_price: 100.4, flatten_pnl_pct: 0.4, final_pnl_pct: -2.8, saved_pct: 3.2 } }] }) });
    }
    return route.continue();
  });
  await page.goto('/#/battle');
  await expect(page.getByText('Where the move occurred').first()).toBeVisible();
  await page.getByRole('button', { name: /Verify freeze/i }).click();
  await expect(page.getByText(/hash matches/i)).toBeVisible();
  await expect(page.getByText(/If flattened at the last Listed close/i)).toBeVisible();

  await page.goto('/#/morgue');
  await expect(page.getByRole('heading', { name: /Every thesis dies/i })).toBeVisible();
  await expect(page.getByText('Test thesis').first()).toBeVisible();
  await expect(page.getByText(/weekend tape gaps against me/i).first()).toBeVisible();
});

test('Shadow Session: morgue and battle do not overflow narrow viewports', async ({ page }) => {
  await mockApi(page);
  for (const view of ['morgue', 'battle', 'arena']) {
    await page.goto(`/#/${view}`);
    await expect(page.locator('main')).toBeVisible();
    const size = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(size.scroll, `${view} should fit viewport`).toBeLessThanOrEqual(size.viewport + 1);
  }
});
