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
  impacts: assets.slice(0, 4).map((asset, index) => ({
    symbol: asset.symbol, asset_name: ['Nvidia', 'Tesla', 'Apple', 'Microsoft'][index], current_price: asset.price,
    impact_pct: -3.2 - index, lower_pct: -5.5 - index, upper_pct: -1.2 - index, confidence: 68,
    model: 'Vibe-Trading measured beta', calibrated: true, calibration_gate_passed: true,
    beta_to_qqq: 1.1 + index * 0.1, beta_source: 'measured', prior_beta: 1.55 - index * 0.1,
    correlation_to_qqq: 0.78 - index * 0.03, paired_observations: 60 - index * 5, observations_minimum: 20,
    fallback_reason: null, short_volatility_pct: 1.15, annualized_volatility_pct: 31.4, severity_scale: 1.0,
  })),
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
  transparency: {
    calibration_minimum_observations: 20, selection_basis: 'current_observed_move', analogue_count: 1,
    analogue_note: 'Analogues were selected mechanically: same-direction daily moves closest in size to the underlying\'s current observed move.',
    volatility_note: 'Uncertainty bands widen with short-window realized volatility from recent live prices and annualized historical volatility.',
  },
  assumptions: { benchmark_move_pct: -5, duration: '24H', sensitivity_method: 'historical' },
  challenge_options: ['The size of the market move', 'The time horizon', 'The historical evidence'],
  analogues: [{ label: 'Historical comparison', outcome: 'Observed next-day outcomes varied.', relevance: 'Context only, not a forecast.' }],
  model_source: 'Vibe-Trading historical calibration + AlphaArena stress engine',
  sources: { market: 'bitget-live', qwen: 'deterministic-fallback', vibe: 'connected', signal: 'connected' },
};

const twinFallback = {
  ...twin,
  id: 'twin-fallback-test',
  impacts: assets.slice(0, 4).map((asset, index) => ({
    symbol: asset.symbol, asset_name: ['Nvidia', 'Tesla', 'Apple', 'Microsoft'][index], current_price: asset.price,
    impact_pct: -4.1 - index, lower_pct: -6.4 - index, upper_pct: -1.9 - index, confidence: 62,
    model: 'Assumption-based prior (uncalibrated)', calibrated: false, calibration_gate_passed: false,
    beta_to_qqq: null, beta_source: 'prior', prior_beta: 1.55 - index * 0.1,
    correlation_to_qqq: null, paired_observations: 7, observations_minimum: 20,
    fallback_reason: 'fewer_than_20_paired_observations', short_volatility_pct: 1.15, annualized_volatility_pct: null, severity_scale: 1.0,
  })),
  model_source: 'Assumption-based priors (uncalibrated)',
};

const portfolioStress = {
  id: 'pf-test', prompt: 'What if Nasdaq falls 5% before the U.S. open?', generated_at: '2026-09-10T10:00:00Z', duration: '24H',
  shock: { driver: 'Nasdaq 100', category: 'nasdaq', magnitude: 5, unit: '%', direction: 'down' },
  legs: [
    {
      symbol: 'rNVDA', asset_name: 'Nvidia', side: 'LONG', stake: 10000, current_price: 100,
      impact_pct: -3.2, lower_pct: -5.5, upper_pct: -1.2, impact_dollars: -320, lower_dollars: -550, upper_dollars: -120,
      confidence: 68, model: 'Vibe-Trading measured beta', calibrated: true, calibration_gate_passed: true,
      beta_to_qqq: 1.1, beta_source: 'measured', prior_beta: 1.55, correlation_to_qqq: 0.78,
      paired_observations: 60, observations_minimum: 20, fallback_reason: null,
      short_volatility_pct: 1.15, annualized_volatility_pct: 31.4, severity_scale: 1.0,
    },
    {
      symbol: 'rAAPL', asset_name: 'Apple', side: 'LONG', stake: 5000, current_price: 134.5,
      impact_pct: -4.05, lower_pct: -6.1, upper_pct: -2.0, impact_dollars: -202.5, lower_dollars: -305, upper_dollars: -100,
      confidence: 66, model: 'Vibe-Trading measured beta', calibrated: true, calibration_gate_passed: true,
      beta_to_qqq: 0.9, beta_source: 'measured', prior_beta: 0.86, correlation_to_qqq: 0.71,
      paired_observations: 52, observations_minimum: 20, fallback_reason: null,
      short_volatility_pct: 0.9, annualized_volatility_pct: 24.8, severity_scale: 1.0,
    },
    {
      symbol: 'rTSLA', asset_name: 'Tesla', side: 'SHORT', stake: 5000, current_price: 117.25,
      impact_pct: 4.4, lower_pct: 2.1, upper_pct: 6.7, impact_dollars: 220, lower_dollars: 105, upper_dollars: 335,
      confidence: 62, model: 'Assumption-based prior (uncalibrated)', calibrated: false, calibration_gate_passed: false,
      beta_to_qqq: null, beta_source: 'prior', prior_beta: 1.42, correlation_to_qqq: null,
      paired_observations: 7, observations_minimum: 20, fallback_reason: 'fewer_than_20_paired_observations',
      short_volatility_pct: 1.6, annualized_volatility_pct: null, severity_scale: 1.0,
    },
  ],
  aggregate: {
    total_stake: 20000, impact_dollars: -302.5, lower_dollars: -750, upper_dollars: 115,
    impact_pct: -1.51, lower_pct: -3.75, upper_pct: 0.58, legs: 3,
    method: 'stake-weighted sum of leg impacts; bounds assume no diversification benefit',
  },
  model_source: 'Hybrid Vibe-Trading calibration + assumption-based priors (uncalibrated)',
  sources: { market: 'bitget-live', vibe: 'connected', signal: 'unavailable', qwen: 'deterministic-fallback' },
  transparency: {
    calibration_minimum_observations: 20,
    aggregate_method: 'stake-weighted sum of leg impacts; bounds assume no diversification benefit',
    side_note: 'SHORT legs mirror the asset move; WAIT legs carry no exposure.',
    volatility_note: 'Each leg\u2019s uncertainty band widens with short-window realized volatility from recent live prices.',
  },
  assumptions: { benchmark_move_pct: -5, duration: '24H', sensitivity_method: 'historical', single_driver_note: 'One scenario driver is parsed from the prompt.' },
  disclaimer: 'Hypothetical stress estimates, not forecasts or recommendations. Paper only.',
};

const trackRecordEmpty = {
  settled_battles: 0, scored_battles: 0, min_settled_battles: 5, insufficient_data: true,
  win_rate: 0, brier_score: null, brier_baseline: null, curve: [],
  disclaimer: 'Paper-only aggregate of your own settled battles.',
};

const trackRecordInsufficient = {
  settled_battles: 3, scored_battles: 2, min_settled_battles: 5, insufficient_data: true,
  win_rate: 66.67, brier_score: null, brier_baseline: null, curve: [],
  disclaimer: 'Paper-only aggregate of your own settled battles.',
};

const trackRecordPopulated = {
  settled_battles: 8, scored_battles: 8, min_settled_battles: 5, insufficient_data: false,
  win_rate: 62.5, brier_score: 0.21, brier_baseline: 0.2344,
  curve: [
    { bucket: '50–60%', stated_midpoint: 55, n: 2, win_rate: 50 },
    { bucket: '60–70%', stated_midpoint: 65, n: 3, win_rate: 66.67 },
    { bucket: '70–80%', stated_midpoint: 75, n: 2, win_rate: 50 },
    { bucket: '80–90%', stated_midpoint: 85, n: 1, win_rate: 100 },
    { bucket: '90–100%', stated_midpoint: 95, n: 0, win_rate: null },
  ],
  disclaimer: 'Paper-only aggregate of your own settled battles. A good past score does not prove a repeatable edge; it only shows whether past confidence matched past outcomes.',
};

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

export async function mockApi(page: Page, options?: { pulseFailure?: boolean; trackRecord?: 'empty' | 'insufficient' | 'populated'; twinFallback?: boolean }) {
  const trackRecord = options?.trackRecord === 'populated'
    ? trackRecordPopulated
    : options?.trackRecord === 'empty'
      ? trackRecordEmpty
      : trackRecordInsufficient;
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
    if (path === '/api/twin/simulate') return json(route, { data: options?.twinFallback ? twinFallback : twin });
    if (path === '/api/twin/portfolio') return json(route, { data: portfolioStress });
    if (path === '/api/arena/battles' && request.method() === 'GET') return json(route, { data: [] });
    if (path === '/api/arena/battles' && request.method() === 'POST') return json(route, { data: { id: 'battle-test', symbol: 'rNVDA', thesis: 'Test thesis', wrong_sentence: 'weekend tape gaps against me', risk_pct: 2.0, kill_price: 98, user_side: 'LONG', ai_side: 'WAIT', opponent: 'NightWatch', stake: 10000, entry_price: 100, current_price: 100, user_pnl_pct: 0, ai_pnl_pct: 0, created_at: '2026-09-10T10:00:00Z', expires_at: '2026-09-11T10:00:00Z', settled_at: null, settled_price: null, status: 'live', source: 'bitget', shadow: null, flatten_before_dark: null } });
    if (path === '/api/arena/battles/battle-test' && request.method() === 'GET') return json(route, { data: { id: 'battle-test', symbol: 'rNVDA', thesis: 'Test thesis', wrong_sentence: 'weekend tape gaps against me', risk_pct: 2.0, kill_price: 98, user_side: 'LONG', ai_side: 'WAIT', opponent: 'NightWatch', stake: 10000, entry_price: 100, current_price: 97.2, user_pnl_pct: -2.8, ai_pnl_pct: 0, created_at: '2026-09-10T10:00:00Z', expires_at: '2026-09-11T10:00:00Z', settled_at: '2026-09-12T03:11:00Z', settled_price: 97.2, settlement_hash: '9f3adeadbeef0001', status: 'settled', source: 'bitget', shadow: { listed_move_pct: 0.4, shadow_move_pct: -3.2, total_move_pct: -2.8, kill_session: 'shadow', kill_at: '2026-09-12T03:11:00Z', candle_count: 24, granularity: '1H', is_estimate: true, last_listed_price: 100.4, session_label: 'Listed = NYSE hours. Shadow = everything else — nights, weekends, holidays.' }, flatten_before_dark: { flatten_price: 100.4, flatten_pnl_pct: 0.4, final_pnl_pct: -2.8, saved_pct: 3.2 } } });
    if (path === '/api/arena/battles/battle-test/verify') return json(route, { data: { battle_id: 'battle-test', verified: true, settlement_hash: '9f3adeadbeef0001' } });
    if (path === '/api/arena/battles/battle-test/review' && request.method() === 'POST') return json(route, { data: { battle_id: 'battle-test', generated_at: '2026-09-12T04:00:00Z', winner: 'ai', user_result_pct: -2.8, ai_result_pct: 0, lesson: 'The Shadow session carried the loss.', what_worked: ['Thesis was falsifiable.'], what_failed: ['Weekend tape moved against the thesis.'], next_rule: 'Write the Shadow risk explicitly before entry.', source: 'deterministic-review' } });
    if (path === '/api/arena/morgue') return json(route, { data: [{ id: 'battle-test', symbol: 'rNVDA', thesis: 'Test thesis', wrong_sentence: 'weekend tape gaps against me', user_side: 'LONG', entry_price: 100, settled_price: 97.2, user_pnl_pct: -2.8, settled_at: '2026-09-12T03:11:00Z', settlement_hash: '9f3adeadbeef0001', shadow: { listed_move_pct: 0.4, shadow_move_pct: -3.2, total_move_pct: -2.8, kill_session: 'shadow', kill_at: '2026-09-12T03:11:00Z', candle_count: 24, granularity: '1H', is_estimate: true, last_listed_price: 100.4, session_label: 'Listed = NYSE hours. Shadow = everything else — nights, weekends, holidays.' } }] });
    if (path === '/api/session/now') return json(route, { data: { now: '2026-09-12T03:11:00Z', session: 'shadow', label: 'Listed = NYSE hours. Shadow = everything else — nights, weekends, holidays.' } });
    if (path === '/api/arena/leaderboard') return json(route, { data: [] });
    if (path === '/api/track-record') return json(route, { data: trackRecord });
    if (path === '/api/traders') return json(route, { data: [] });
    if (path.startsWith('/api/integrations/')) return json(route, { data: {} });
    if (path.startsWith('/api/research/vibe/')) return json(route, { data: { connected: true, ticker: 'NVDA', evidence: {}, historical_stats: {}, analogues: [], provenance: {}, errors: [] } });
    return json(route, { data: [] });
  });
}
