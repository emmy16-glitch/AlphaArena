import { apiData } from '../lib/api';

export type ParticipantStatus = 'decided' | 'unavailable';
export type ThesisDirection = 'Bullish' | 'Bearish' | 'Sideways';

export type SessionParticipant = {
  lane: string;
  direction: 'LONG' | 'SHORT' | 'WAIT' | null;
  confidence: number | null;
  model: string | null;
  status: ParticipantStatus;
  snapshot_id: string;
  reasoning: string | null;
  report_id?: string;
  error?: string;
};

export type SessionRefusal = {
  code: string;
  title: string;
  explanation: string;
  technical?: string;
};

export type DecisionSession = {
  id: string;
  symbol: string;
  thesis: string;
  horizon: string;
  horizon_hours: number;
  snapshot: {
    id: string;
    symbol: string;
    captured_at: string;
    market_timestamp: number;
    price: number;
    change_pct_24h: number;
    spread_bps: number;
    spark: number[];
    source: string;
  };
  snapshot_hash: string;
  participants: Record<string, SessionParticipant>;
  refusal: SessionRefusal | null;
  risk: { risk_pct: number; max_risk_pct: number; mode: string };
  evidence_references: Record<string, unknown>;
  dataset_source_provenance: string;
  ready_for_arena: boolean;
  decided_count: number;
  unavailable_count: number;
  created_at: string;
  receipt: Record<string, unknown>;
  receipt_hash: string;
  arena_battle_id: string | null;
};

export const HORIZONS = ['30m', '1h', '4h', '24h'] as const;

export function thesisDirectionToMarket(value: ThesisDirection): 'LONG' | 'SHORT' | 'WAIT' {
  return value === 'Bullish' ? 'LONG' : value === 'Bearish' ? 'SHORT' : 'WAIT';
}

export function marketToCall(value: string | null | undefined): 'BUY' | 'HOLD' | 'SELL' | '—' {
  if (value === 'LONG') return 'BUY';
  if (value === 'SHORT') return 'SELL';
  if (value === 'WAIT') return 'HOLD';
  return '—';
}

export const sessionApi = {
  create: (body: { symbol: string; thesis: string; human_direction: string; horizon: string; confidence: number; risk_pct?: number }) =>
    apiData<DecisionSession>('/api/decision-sessions', { method: 'POST', body: JSON.stringify(body) }, 90_000),
  get: (id: string) => apiData<DecisionSession>(`/api/decision-sessions/${encodeURIComponent(id)}`),
  receipt: (id: string) =>
    apiData<{ decision_session_id: string; verified: boolean; receipt_hash: string; recomputed_hash: string }>(
      `/api/decision-sessions/${encodeURIComponent(id)}/receipt`,
    ),
  enterArena: (id: string) =>
    apiData<{ session: DecisionSession; battle: { id: string } }>(
      `/api/decision-sessions/${encodeURIComponent(id)}/enter-arena`,
      { method: 'POST' },
      90_000,
    ),
};
