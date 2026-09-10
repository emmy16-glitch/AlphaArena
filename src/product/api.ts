const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

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
  symbol: string; current_price: number; impact_pct: number; lower_pct: number; upper_pct: number; confidence: number;
  model?: string | null; beta_to_qqq?: number | null;
};

export type TwinResponse = {
  id: string; prompt: string; generated_at: string; duration: string;
  shock: { driver: string; category: string; magnitude: number; unit: string; direction: 'up'|'down'|'mixed' };
  impacts: TwinImpact[]; explanation: string; analogues: HistoricalAnalogue[]; model_source: string; sources: SourceStatus;
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
  connected: boolean; ticker: string; evidence: Record<string, unknown>; historical_stats: Record<string, number | null>;
  analogues: HistoricalAnalogue[]; provenance: Record<string, unknown>; errors: string[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try { const body = await response.json(); detail = body.detail || detail; } catch { /* keep status */ }
    throw new Error(detail);
  }
  const payload = await response.json() as { data: T };
  return payload.data;
}

export const productApi = {
  pulse: () => request<PulseEvent[]>('/api/pulse'),
  nightwatch: (body: { symbol: string; direction: Direction; thesis: string; risk_pct?: number; holding_period?: string }) =>
    request<NightWatchReport>('/api/nightwatch/analyze', { method: 'POST', body: JSON.stringify(body) }),
  nightwatchHistory: () => request<NightWatchReport[]>('/api/nightwatch/history'),
  simulate: (body: { prompt: string; symbols: string[]; severity: number; duration: string }) =>
    request<TwinResponse>('/api/twin/simulate', { method: 'POST', body: JSON.stringify(body) }),
  scenarioHistory: () => request<TwinResponse[]>('/api/twin/history'),
  createBattle: (body: { symbol: string; user_side: Direction; ai_side: Direction; thesis: string; stake: number; duration_hours: number; opponent?: string }) =>
    request<BattleView>('/api/arena/battles', { method: 'POST', body: JSON.stringify(body) }),
  battles: () => request<BattleView[]>('/api/arena/battles'),
  battle: (id: string) => request<BattleView>(`/api/arena/battles/${encodeURIComponent(id)}`),
  reviewBattle: (id: string) => request<BattleReview>(`/api/arena/battles/${encodeURIComponent(id)}/review`, { method: 'POST' }),
  portfolio: () => request<PortfolioSummary>('/api/arena/portfolio'),
  leaderboard: () => request<LeaderRow[]>('/api/arena/leaderboard'),
  createTrader: (body: { name: string; style: TraderProfile['style']; risk_appetite: number; holding_period: TraderProfile['holding_period']; assets: string[] }) =>
    request<TraderProfile>('/api/traders', { method: 'POST', body: JSON.stringify(body) }),
  traders: () => request<TraderProfile[]>('/api/traders'),
  vibeResearch: (symbol: string) => request<VibeSnapshot>(`/api/research/vibe/${encodeURIComponent(symbol)}`),
  integrations: () => request<Record<string, { configured: boolean; mode?: string; model?: string; fallback?: string }>>('/api/integrations/status'),
  diagnostics: () => request<Record<string, unknown>>('/api/integrations/diagnostics'),
};
