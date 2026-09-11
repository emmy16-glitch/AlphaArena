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
  model?: string | null; beta_to_qqq?: number | null;
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
  assumptions?: TwinAssumptions | null; challenge_options?: string[];
};

export type PulseEvent = {
  id: string; symbol: string; severity: 'info'|'watch'|'elevated'; title: string; summary: string;
  score: number; price?: number; change_pct?: number; tags: string[]; detected_at: string;
};

export type BattleView = {
  id: string; symbol: string; thesis: string; user_side: Direction; ai_side: Direction; opponent: string;
  stake: number; entry_price: number; current_price: number; user_pnl_pct: number; ai_pnl_pct: number;
  created_at: string; expires_at: string; settled_at?: string | null; settled_price?: number | null;
  status: 'live'|'settled'; source: string;
};

export type PortfolioSummary = {
  starting_capital: number; net_value: number; free_capital: number; deployed_capital: number;
  return_pct: number; open_battles: number; settled_battles: number;
};

export type LeaderRow = { rank: number; name: string; type: 'human'|'ai'; style: string; return_pct: number; win_rate: number; battles: number };

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
  scenarioHistory: () => apiData<TwinResponse[]>('/api/twin/history'),
  createBattle: (body: { symbol: string; user_side: Direction; ai_side: Direction; thesis: string; stake: number; duration_hours: number; opponent?: string }) =>
    apiData<BattleView>('/api/arena/battles', { method: 'POST', body: JSON.stringify(body) }),
  battles: () => apiData<BattleView[]>('/api/arena/battles'),
  battle: (id: string) => apiData<BattleView>(`/api/arena/battles/${encodeURIComponent(id)}`),
  reviewBattle: (id: string) => apiData<BattleReview>(`/api/arena/battles/${encodeURIComponent(id)}/review`, { method: 'POST' }),
  portfolio: () => apiData<PortfolioSummary>('/api/arena/portfolio'),
  leaderboard: () => apiData<LeaderRow[]>('/api/arena/leaderboard'),
  createTrader: (body: { name: string; style: TraderProfile['style']; risk_appetite: number; holding_period: TraderProfile['holding_period']; assets: string[] }) =>
    apiData<TraderProfile>('/api/traders', { method: 'POST', body: JSON.stringify(body) }),
  traders: () => apiData<TraderProfile[]>('/api/traders'),
  vibeResearch: (symbol: string) => apiData<VibeSnapshot>(`/api/research/vibe/${encodeURIComponent(symbol)}`),
  integrations: () => apiData<Record<string, unknown>>('/api/integrations/status'),
  diagnostics: () => apiData<Record<string, unknown>>('/api/integrations/diagnostics'),
  budget: () => apiData<BudgetStatus>('/api/budget/status'),
};
