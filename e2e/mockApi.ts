import type { Page, Route } from '@playwright/test';

const assets = ['rNVDA', 'rTSLA', 'rAAPL', 'rMSFT', 'rAMD', 'rQQQ'].map((symbol, index) => ({
  symbol,
  exchangeSymbol: `${symbol}USDT`,
  price: 100 + index * 17.25,
  changePct: index % 2 === 0 ? 1.42 + index * 0.1 : -0.84 - index * 0.1,
  changeAbs: 1.42,
  volume: `${12 + index}.4M`,
  high24: 104 + index * 17.25,
  low24: 96 + index * 17.25,
  spark: [98, 99, 100, 101, 100.5, 102, 103].map((value) => value + index * 17.25),
  timestamp: 1789034400000,
  source: 'bitget',
  isReality: true,
  bid: 99.98,
  ask: 100.02,
  spreadBps: 4,
}));

const portfolio = {
  starting_capital: 100000,
  net_value: 100000,
  free_capital: 100000,
  deployed_capital: 0,
  return_pct: 0,
  open_battles: 0,
  settled_battles: 0,
};

const budget = {
  virtual_capital: 100000,
  real_money_trading: false,
  background_llm_calls: 0,
  qwen: {
    configured: false,
    daily_attempt_limit: 12,
    attempts_used_today: 0,
    attempts_remaining_today: 12,
    max_output_tokens_per_attempt: 3000,
    max_attempts_per_request: 2,
    resets_at: '2026-09-11T00:00:00+00:00',
    accounting_scope: 'per-api-process safety fuse; provider billing remains source of truth',
  },
  vibe_trading: { mode: 'research-only MCP sidecar', shell_tools_enabled: false, cache_seconds: 900 },
};

const pulse = [{
  id: 'pulse-test', symbol: 'rNVDA', severity: 'watch', title: 'NVDA momentum needs a second look',
  summary: 'The live move is measurable. AlphaArena asks whether the thesis still survives a weaker broad market.',
  score: 71, price: 100, change_pct: 1.42, tags: ['Momentum', 'Paper only'], detected_at: '2026-09-10T10:00:00Z',
}];

const nightwatch = {
  id: 'nw-test', symbol: 'rNVDA', direction: 'LONG', thesis: 'Momentum can continue through the next 24 hours.',
  generated_at: '2026-09-10T10:00:00Z', resilience: 64, confidence: 72, risk_level: 'MEDIUM', verdict: 'WAIT',
  headline: 'The idea survives, but confirmation is incomplete.',
  summary: 'The live tape supports momentum while volatility and broad-market sensitivity remain meaningful objections.',
  supports: [{ title: 'Live momentum', detail: 'Bitget Reality shows a positive 24-hour move.', source: 'Bitget Reality market data', strength: 'medium' }],
  objections: [{ title: 'Broad-market risk', detail: 'A weaker Nasdaq session can challenge the thesis.', source: 'Vibe-Trading historical calibration', strength: 'medium' }],
  analogues: [{ label: 'Historical analogue', outcome: 'The next daily move was mixed.', relevance: 'Mechanically selected observation; not a prediction.' }],
  stress_scenarios: [{ name: 'Nasdaq -5%', impact_pct: -4.2, detail: 'Stress estimate, not a forecast.' }],
  invalidation_conditions: ['Price structure reverses against the thesis.'],
  agents: [],
  sources: { market: 'bitget-live', qwen: 'deterministic-fallback', vibe: 'connected', signal: 'connected' },
};

const twin = {
  id: 'twin-test', prompt: 'What if Nasdaq falls 5% before the U.S. open?', generated_at: '2026-09-10T10:00:00Z', duration: '24H',
  shock: { driver: 'Nasdaq 100', category: 'nasdaq', magnitude: 5, unit: '%', direction: 'down' },
  impacts: assets.slice(0, 4).map((asset, index) => ({ symbol: asset.symbol, current_price: asset.price, impact_pct: -3.2 - index, lower_pct: -5.5 - index, upper_pct: -1.2 - index, confidence: 68, model: 'Vibe-Trading measured beta', beta_to_qqq: 1.1 + index * 0.1 })),
  explanation: 'Measured historical sensitivity is applied where enough aligned observations exist; uncertainty is widened with current volatility.',
  explanation_view: {
    plain_summary: 'If the Nasdaq 100 fell 5%, the assets with the strongest historical sensitivity in this simulation could move the most. The evidence is fairly strong, but not conclusive.',
    impact_summary: 'The largest simulated move is -3.20% for Nvidia.',
    limitations: ['This is a hypothetical stress test, not a forecast or recommendation.', 'Company-specific news can make the estimate wrong.'],
    confidence_label: 'fairly_strong',
  },
  historical_context: {
    selection_basis: 'current_observed_move', data_frequency: 'daily',
    selection_disclaimer: 'These daily observations were selected using the underlying asset\'s current observed move. They are context, not scenario matches or predictions.',
  },
  assumptions: { benchmark_move_pct: -5, duration: '24H', sensitivity_method: 'historical' },
  challenge_options: ['The size of the market move', 'The time horizon', 'The historical evidence'],
  analogues: [{ label: 'Historical comparison', outcome: 'Observed next-day outcomes varied.', relevance: 'Context only, not a forecast.' }],
  model_source: 'Vibe-Trading historical calibration + AlphaArena stress engine',
  sources: { market: 'bitget-live', qwen: 'deterministic-fallback', vibe: 'connected', signal: 'connected' },
};

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

export async function mockApi(page: Page, options?: { pulseFailure?: boolean }) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/api/market/assets') return json(route, { data: assets });
    if (path.startsWith('/api/market/assets/')) return json(route, { data: assets.find((asset) => asset.symbol === decodeURIComponent(path.split('/').pop() || '')) || assets[0] });
    if (path === '/api/arena/portfolio') return json(route, { data: portfolio });
    if (path === '/api/budget/status') return json(route, { data: budget });
    if (path === '/api/pulse' && options?.pulseFailure) return json(route, { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Live market data is taking longer than usual.', action: 'Try again in a moment.', retryable: true } }, 502);
    if (path === '/api/pulse') return json(route, { data: pulse });
    if (path === '/api/nightwatch/analyze') return json(route, { data: nightwatch });
    if (path === '/api/twin/simulate') return json(route, { data: twin });
    if (path === '/api/arena/battles' && request.method() === 'GET') return json(route, { data: [] });
    if (path === '/api/arena/battles' && request.method() === 'POST') return json(route, { data: { id: 'battle-test', symbol: 'rNVDA', thesis: 'Test thesis', user_side: 'LONG', ai_side: 'WAIT', opponent: 'NightWatch', stake: 10000, entry_price: 100, current_price: 100, user_pnl_pct: 0, ai_pnl_pct: 0, created_at: '2026-09-10T10:00:00Z', expires_at: '2026-09-11T10:00:00Z', settled_at: null, settled_price: null, status: 'live', source: 'bitget' } });
    if (path === '/api/arena/leaderboard') return json(route, { data: [] });
    if (path === '/api/traders') return json(route, { data: [] });
    if (path.startsWith('/api/integrations/')) return json(route, { data: {} });
    if (path.startsWith('/api/research/vibe/')) return json(route, { data: { connected: true, ticker: 'NVDA', evidence: {}, historical_stats: {}, analogues: [], provenance: {}, errors: [] } });
    return json(route, { data: [] });
  });
}
