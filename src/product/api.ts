import { apiData } from '../lib/api';

export type Direction = 'LONG' | 'SHORT' | 'WAIT';
export type SourceStatus = { market: string; qwen: string; vibe: string; signal: string };
export type EvidenceItem = { title: string; detail: string; source: string; strength: 'low'|'medium'|'high' };
export type AgentView = { role: string; stance: 'support'|'oppose'|'neutral'; confidence: number; summary: string; evidence: string[] };
export type HistoricalAnalogue = { label: string; outcome: string; relevance: string };
export type StressScenario = { name: string; impact_pct: number; detail: string };

export type NightWatchReport = {
  id: string; symbol: string; direction: Direction; thesis: string; generated_at: string;
  resilience: number; confidence: number; risk_level: 'LOW'|'MEDIUM'|'HIGH'|'EXTREME'; verdict: Direction;
  headline: string; summary: string; supports: EvidenceItem[]; objections: EvidenceItem[];
  analogues: HistoricalAnalogue[]; stress_scenarios: StressScenario[]; invalidation_conditions: string[];
  agents: AgentView[]; sources: SourceStatus;
};

export type TwinImpact = {
  symbol: string; asset_name?: string | null; current_price: number; impact_pct: number; lower_pct: number; upper_pct: number; confidence: number;
  model?: string | null; calibrated?: boolean | null; beta_to_qqq?: number | null;
  beta_source?: 'measured' | 'prior' | null; prior_beta?: number | null; correlation_to_qqq?: number | null;
  paired_observations?: number | null; observations_minimum?: number | null; calibration_gate_passed?: boolean | null;
  fallback_reason?: 'fewer_than_20_paired_observations' | 'non_nasdaq_category_uses_prior' | 'vibe_unavailable' | null;
  short_volatility_pct?: number | null; annualized_volatility_pct?: number | null; severity_scale?: number | null;
};

export type TwinTransparency = {
  calibration_minimum_observations?: number | null; selection_basis?: string | null;
  analogue_count?: number | null; analogue_note?: string | null; volatility_note?: string | null;
};

export type TwinExplanation = {
  plain_summary: string; impact_summary: string; limitations: string[];
  confidence_label: 'limited'|'mixed'|'fairly_strong'|'stronger';
};

export type HistoricalContextMeta = {
  selection_basis: 'current_observed_move'|'scenario_match'; data_frequency: 'daily'|'intraday'|'mixed'; selection_disclaimer: string;
};

export type TwinAssumptions = { benchmark_move_pct: number; duration: string; sensitivity_method: 'historical'|'conservative'|'custom' };

export type TwinResponse = {
  id: string; prompt: string; generated_at: string; duration: string;
  shock: { driver: string; category: string; magnitude: number; unit: string; direction: 'up'|'down'|'mixed' };
  impacts: TwinImpact[]; explanation: string; analogues: HistoricalAnalogue[]; model_source: string; sources: SourceStatus;
  explanation_view?: TwinExplanation | null; historical_context?: HistoricalContextMeta | null;
  assumptions?: TwinAssumptions | null; challenge_options?: string[]; transparency?: TwinTransparency | null;
};

export type PortfolioPosition = { symbol: string; side: Direction; stake: number };

export type PortfolioLeg = TwinImpact & {
  side: Direction; stake: number; impact_dollars: number; lower_dollars: number; upper_dollars: number;
};

export type PortfolioAggregate = {
  total_stake: number; impact_dollars: number; lower_dollars: number; upper_dollars: number;
  impact_pct: number; lower_pct: number; upper_pct: number; legs: number; method: string;
};

export type PortfolioStressResponse = {
  id: string; prompt: string; generated_at: string; duration: string;
  shock: TwinResponse['shock']; legs: PortfolioLeg[]; aggregate: PortfolioAggregate;
  model_source: string; sources: SourceStatus; transparency?: TwinTransparency | null;
  assumptions?: TwinAssumptions | null; disclaimer?: string;
};

export type PulseEvent = {
  id: string; symbol: string; severity: 'info'|'watch'|'elevated'; title: string; summary: string;
  score: number; price?: number; change_pct?: number; tags: string[]; detected_at: string;
};

export type ShadowAttribution = {
  listed_move_pct: number; shadow_move_pct: number; total_move_pct: number;
  kill_session: string | null; kill_at: string | null;
  kill_hit?: boolean | null; kill_price_touched?: number | null;
  candle_count: number;
  granularity: string; is_estimate: boolean; last_listed_price: number | null;
  session_label: string;
};

export type FlattenBeforeDark = {
  flatten_price: number; flatten_pnl_pct: number; final_pnl_pct: number; saved_pct: number;
};

export type MorgueRow = {
  id: string; symbol: string; thesis: string; wrong_sentence: string | null;
  user_side: Direction; entry_price: number; settled_price: number | null;
  user_pnl_pct: number; settled_at: string | null; settlement_hash: string | null;
  shadow: ShadowAttribution | null;
};

export type BattleView = {
  id: string; symbol: string; thesis: string; wrong_sentence?: string | null;
  risk_pct?: number | null; kill_price?: number | null;
  user_side: Direction; ai_side: Direction; opponent: string;
  stake: number; quantity?: number | null; entry_price: number; current_price: number; user_pnl_pct: number; ai_pnl_pct: number;
  created_at: string; expires_at: string; settled_at?: string | null; settled_price?: number | null;
  settlement_hash?: string | null; stated_confidence?: number | null;
  status: 'live'|'settled'; source: string;
  shadow?: ShadowAttribution | null; flatten_before_dark?: FlattenBeforeDark | null;
};

export type PortfolioSummary = {
  starting_capital: number; net_value: number; free_capital: number; deployed_capital: number;
  return_pct: number; open_battles: number; settled_battles: number;
  win_rate?: number | null; profit_factor?: number | null; max_drawdown_pct?: number | null; sharpe_like?: number | null;
};

export type LeaderRow = { rank: number; name: string; type: 'human'|'ai'; style: string; return_pct: number; win_rate: number; battles: number; profit_factor?: number | null };

export type PaperLogRow = {
  timestamp: string; battle_id: string; asset: string; direction: Direction; opponent_side: Direction;
  entry_price: number; exit_price: number | null; quantity: number; stake: number; status: string;
  pnl_pct: number; pnl_dollars: number; account_balance_after: number | null;
  settled_at: string | null; settlement_hash: string | null; hash_verified: boolean | null; thesis: string;
};

export type BacktestReport = {
  symbol: string; exchange_symbol?: string; entry_price?: number; prices_used: number; frequency: string;
  metrics: { num_bars: number; return_pct: number; max_drawdown_pct: number; sharpe_like: number; win_rate: number; method: string };
  code: string; disclaimer: string;
};

export type PlaybookConfig = Record<string, string>;

export type CalibrationBucket = { bucket: string; stated_midpoint: number; n: number; win_rate: number | null };

export type TrackRecord = {
  settled_battles: number; scored_battles: number; min_settled_battles: number; insufficient_data: boolean;
  win_rate: number; brier_score: number | null; brier_baseline: number | null;
  curve: CalibrationBucket[]; disclaimer: string;
};

export type TraderProfile = {
  id: string; name: string; style: 'Event-driven'|'Momentum'|'Contrarian'|'Risk-first'; risk_appetite: number;
  holding_period: '1H'|'6H'|'24H'|'7D'|'30D'; assets: string[]; created_at: string; updated_at: string; mode: 'virtual-only';
};

export type BattleReview = {
  battle_id: string; generated_at: string; winner: 'user'|'ai'|'draw'; user_result_pct: number; ai_result_pct: number;
  lesson: string; what_worked: string[]; what_failed: string[]; next_rule: string; source: string;
};

export type VibeSnapshot = {
  connected: boolean; ticker: string; evidence: Record<string, unknown>; historical_stats: Record<string, unknown>;
  analogues: HistoricalAnalogue[]; provenance: Record<string, unknown>; errors: string[];
};

export type BudgetStatus = {
  virtual_capital: number;
  real_money_trading: false;
  background_llm_calls: number;
  qwen: {
    configured: boolean;
    daily_attempt_limit: number;
    attempts_used_today: number;
    attempts_remaining_today: number;
    max_output_tokens_per_attempt: number;
    max_attempts_per_request: number;
    resets_at: string;
    accounting_scope: string;
  };
  vibe_trading: { mode: string; shell_tools_enabled: false; cache_seconds: number };
};

export const productApi = {
  pulse: () => apiData<PulseEvent[]>('/api/pulse', undefined, 20_000),
  nightwatch: (body: { symbol: string; direction: Direction; thesis: string; risk_pct?: number; holding_period?: string }) =>
    apiData<NightWatchReport>('/api/nightwatch/analyze', { method: 'POST', body: JSON.stringify(body) }),
  nightwatchHistory: () => apiData<NightWatchReport[]>('/api/nightwatch/history'),
  simulate: (body: { prompt: string; symbols: string[]; severity: number; duration: string }) =>
    apiData<TwinResponse>('/api/twin/simulate', { method: 'POST', body: JSON.stringify(body) }),
  portfolioStress: (body: { prompt: string; positions: PortfolioPosition[]; severity: number; duration: string }) =>
    apiData<PortfolioStressResponse>('/api/twin/portfolio', { method: 'POST', body: JSON.stringify(body) }),
  scenarioHistory: () => apiData<TwinResponse[]>('/api/twin/history'),
  createBattle: (body: { symbol: string; user_side: Direction; ai_side: Direction; thesis: string; wrong_sentence?: string; risk_pct?: number; stake: number; duration_hours: number; opponent?: string; stated_confidence?: number }) =>
    apiData<BattleView>('/api/arena/battles', { method: 'POST', body: JSON.stringify(body) }),
  battles: () => apiData<BattleView[]>('/api/arena/battles'),
  battle: (id: string) => apiData<BattleView>(`/api/arena/battles/${encodeURIComponent(id)}`),
  reviewBattle: (id: string) => apiData<BattleReview>(`/api/arena/battles/${encodeURIComponent(id)}/review`, { method: 'POST' }),
  portfolio: (signal?: AbortSignal) => apiData<PortfolioSummary>('/api/arena/portfolio', { signal }),
  leaderboard: () => apiData<LeaderRow[]>('/api/arena/leaderboard'),
  trackRecord: () => apiData<TrackRecord>('/api/track-record'),
  paperLog: () => apiData<PaperLogRow[]>('/api/arena/export.json'),
  backtest: (symbol: string) => apiData<BacktestReport>(`/api/research/backtest/${encodeURIComponent(symbol)}`),
  playbook: (scenarioId: string) => apiData<PlaybookConfig>(`/api/twin/playbook/${encodeURIComponent(scenarioId)}`),
  verifyBattle: (id: string) => apiData<{ battle_id: string; verified: boolean; settlement_hash: string | null }>(`/api/arena/battles/${encodeURIComponent(id)}/verify`),
  morgue: () => apiData<MorgueRow[]>('/api/arena/morgue'),
  sessionNow: () => apiData<{ now: string; session: 'listed' | 'shadow'; label: string }>('/api/session/now'),
  createTrader: (body: { name: string; style: TraderProfile['style']; risk_appetite: number; holding_period: TraderProfile['holding_period']; assets: string[] }) =>
    apiData<TraderProfile>('/api/traders', { method: 'POST', body: JSON.stringify(body) }),
  traders: () => apiData<TraderProfile[]>('/api/traders'),
  vibeResearch: (symbol: string) => apiData<VibeSnapshot>(`/api/research/vibe/${encodeURIComponent(symbol)}`),
  integrations: () => apiData<Record<string, unknown>>('/api/integrations/status'),
  diagnostics: () => apiData<Record<string, unknown>>('/api/integrations/diagnostics'),
  budget: () => apiData<BudgetStatus>('/api/budget/status'),
};
