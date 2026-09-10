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

export type TwinResponse = {
  id: string; prompt: string; generated_at: string; duration: string;
  shock: { driver: string; category: string; magnitude: number; unit: string; direction: 'up'|'down'|'mixed' };
  impacts: Array<{ symbol: string; current_price: number; impact_pct: number; lower_pct: number; upper_pct: number; confidence: number }>;
  explanation: string; analogues: HistoricalAnalogue[]; model_source: string; sources: SourceStatus;
};

export type PulseEvent = {
  id: string; symbol: string; severity: 'info'|'watch'|'elevated'; title: string; summary: string;
  score: number; price?: number; change_pct?: number; tags: string[]; detected_at: string;
};

export type BattleView = {
  id: string; symbol: string; thesis: string; user_side: Direction; ai_side: Direction; opponent: string;
  stake: number; entry_price: number; current_price: number; user_pnl_pct: number; ai_pnl_pct: number;
  created_at: string; expires_at: string; status: 'live'|'settled'; source: string;
};

export type PortfolioSummary = {
  starting_capital: number; net_value: number; free_capital: number; deployed_capital: number;
  return_pct: number; open_battles: number; settled_battles: number;
};

export type LeaderRow = { rank: number; name: string; type: 'human'|'ai'; style: string; return_pct: number; win_rate: number; battles: number };

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
  simulate: (body: { prompt: string; symbols: string[]; severity: number; duration: string }) =>
    request<TwinResponse>('/api/twin/simulate', { method: 'POST', body: JSON.stringify(body) }),
  createBattle: (body: { symbol: string; user_side: Direction; ai_side: Direction; thesis: string; stake: number; duration_hours: number; opponent?: string }) =>
    request<BattleView>('/api/arena/battles', { method: 'POST', body: JSON.stringify(body) }),
  battles: () => request<BattleView[]>('/api/arena/battles'),
  battle: (id: string) => request<BattleView>(`/api/arena/battles/${encodeURIComponent(id)}`),
  portfolio: () => request<PortfolioSummary>('/api/arena/portfolio'),
  leaderboard: () => request<LeaderRow[]>('/api/arena/leaderboard'),
  integrations: () => request<Record<string, { configured: boolean; mode?: string; model?: string; fallback?: string }>>('/api/integrations/status'),
};
