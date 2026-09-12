from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Direction = Literal["LONG", "SHORT", "WAIT"]


class SourceStatus(BaseModel):
    market: str = "bitget"
    qwen: str = "unconfigured"
    vibe: str = "unconfigured"
    signal: str = "available"


class EvidenceItem(BaseModel):
    title: str
    detail: str
    source: str
    strength: Literal["low", "medium", "high"] = "medium"


class AgentView(BaseModel):
    role: str
    stance: Literal["support", "oppose", "neutral"]
    confidence: int = Field(ge=0, le=100)
    summary: str
    evidence: list[str] = Field(default_factory=list)


class StressScenario(BaseModel):
    name: str
    impact_pct: float
    detail: str


class HistoricalAnalogue(BaseModel):
    label: str
    outcome: str
    relevance: str


class NightWatchRequest(BaseModel):
    symbol: str = "rNVDA"
    direction: Direction = "LONG"
    thesis: str = Field(min_length=8, max_length=2000)
    entry_price: float | None = Field(default=None, gt=0)
    holding_period: str = "24H"
    risk_pct: float = Field(default=2.0, ge=0.1, le=25)


class NightWatchReport(BaseModel):
    id: str
    symbol: str
    direction: Direction
    thesis: str
    generated_at: str
    resilience: int = Field(ge=0, le=100)
    confidence: int = Field(ge=0, le=100)
    risk_level: Literal["LOW", "MEDIUM", "HIGH", "EXTREME"]
    verdict: Direction
    headline: str
    summary: str
    supports: list[EvidenceItem] = Field(default_factory=list)
    objections: list[EvidenceItem] = Field(default_factory=list)
    analogues: list[HistoricalAnalogue] = Field(default_factory=list)
    stress_scenarios: list[StressScenario] = Field(default_factory=list)
    invalidation_conditions: list[str] = Field(default_factory=list)
    agents: list[AgentView] = Field(default_factory=list)
    sources: SourceStatus


class MarketTwinRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=1000)
    symbols: list[str] = Field(default_factory=lambda: ["rNVDA", "rTSLA", "rAAPL", "rQQQ"])
    severity: int = Field(default=60, ge=10, le=100)
    duration: str = "24H"


class PortfolioPosition(BaseModel):
    symbol: str = Field(min_length=1, max_length=16)
    side: Direction = "LONG"
    stake: float = Field(gt=0, le=100_000)


class PortfolioStressRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=1000)
    positions: list[PortfolioPosition] = Field(min_length=1, max_length=8)
    severity: int = Field(default=60, ge=10, le=100)
    duration: str = "24H"


class ParsedShock(BaseModel):
    driver: str
    category: str
    magnitude: float
    unit: str
    direction: Literal["up", "down", "mixed"]


class TwinImpact(BaseModel):
    symbol: str
    asset_name: str | None = None
    current_price: float
    impact_pct: float
    lower_pct: float
    upper_pct: float
    confidence: int
    model: str | None = None
    calibrated: bool | None = None
    beta_to_qqq: float | None = None
    # "Show your work" transparency inputs (all optional for backward compat).
    beta_source: Literal["measured", "prior"] | None = None
    prior_beta: float | None = None
    correlation_to_qqq: float | None = None
    paired_observations: int | None = None
    observations_minimum: int | None = None
    calibration_gate_passed: bool | None = None
    fallback_reason: Literal[
        "fewer_than_20_paired_observations",
        "non_nasdaq_category_uses_prior",
        "vibe_unavailable",
    ] | None = None
    short_volatility_pct: float | None = None
    annualized_volatility_pct: float | None = None
    severity_scale: float | None = None


class TwinExplanation(BaseModel):
    plain_summary: str
    impact_summary: str
    limitations: list[str] = Field(default_factory=list)
    confidence_label: Literal["limited", "mixed", "fairly_strong", "stronger"]


class HistoricalContextMeta(BaseModel):
    selection_basis: Literal["current_observed_move", "scenario_match"] = "current_observed_move"
    data_frequency: Literal["daily", "intraday", "mixed"] = "daily"
    selection_disclaimer: str


class TwinAssumptions(BaseModel):
    benchmark_move_pct: float
    duration: str
    sensitivity_method: Literal["historical", "conservative", "custom"] = "historical"


class MarketTwinResponse(BaseModel):
    id: str
    prompt: str
    generated_at: str
    duration: str
    shock: ParsedShock
    impacts: list[TwinImpact] = Field(default_factory=list)
    explanation: str
    analogues: list[HistoricalAnalogue] = Field(default_factory=list)
    model_source: str
    sources: SourceStatus
    explanation_view: TwinExplanation | None = None
    historical_context: HistoricalContextMeta | None = None
    assumptions: TwinAssumptions | None = None
    challenge_options: list[str] = Field(default_factory=list)
    transparency: dict[str, Any] | None = None


class PulseEvent(BaseModel):
    id: str
    symbol: str
    severity: Literal["info", "watch", "elevated"]
    title: str
    summary: str
    score: int = Field(ge=0, le=100)
    price: float | None = None
    change_pct: float | None = None
    tags: list[str] = Field(default_factory=list)
    detected_at: str


class BattleCreateRequest(BaseModel):
    symbol: str = "rNVDA"
    user_side: Direction = "LONG"
    ai_side: Direction = "WAIT"
    thesis: str = Field(min_length=4, max_length=1200)
    # Commitment ritual: locked at creation, hashed into the freeze,
    # played back verbatim at settlement. Never paraphrased.
    wrong_sentence: str | None = Field(default=None, max_length=500)
    risk_pct: float = Field(default=2.0, ge=0.1, le=25)
    stake: float = Field(default=10_000, gt=0, le=100_000)
    duration_hours: int = Field(default=24, ge=1, le=168)
    opponent: str = Field(default="NightWatch", min_length=1, max_length=80)
    stated_confidence: float | None = Field(default=None, ge=0, le=100)


class ShadowAttribution(BaseModel):
    listed_move_pct: float = 0.0
    shadow_move_pct: float = 0.0
    total_move_pct: float = 0.0
    kill_session: str | None = None
    kill_at: str | None = None
    kill_hit: bool | None = None
    kill_price_touched: float | None = None
    candle_count: int = 0
    granularity: str = "1H"
    is_estimate: bool = True
    last_listed_price: float | None = None
    session_label: str = "Listed = NYSE hours. Shadow = everything else — nights, weekends, holidays."


class FlattenBeforeDark(BaseModel):
    flatten_price: float
    flatten_pnl_pct: float
    final_pnl_pct: float
    saved_pct: float


class BattleView(BaseModel):
    id: str
    symbol: str
    thesis: str
    wrong_sentence: str | None = None
    risk_pct: float | None = None
    kill_price: float | None = None
    user_side: Direction
    ai_side: Direction
    opponent: str
    stake: float
    quantity: float | None = None
    entry_price: float
    current_price: float
    user_pnl_pct: float
    ai_pnl_pct: float
    created_at: str
    expires_at: str
    settled_at: str | None = None
    settled_price: float | None = None
    settlement_hash: str | None = None
    stated_confidence: float | None = None
    status: Literal["live", "settled"]
    source: str = "bitget"
    shadow: ShadowAttribution | None = None
    flatten_before_dark: FlattenBeforeDark | None = None


class PortfolioSummary(BaseModel):
    starting_capital: float
    net_value: float
    free_capital: float
    deployed_capital: float
    return_pct: float
    open_battles: int
    settled_battles: int
    win_rate: float | None = None
    profit_factor: float | None = None
    max_drawdown_pct: float | None = None
    sharpe_like: float | None = None


class LeaderRow(BaseModel):
    rank: int
    name: str
    type: Literal["human", "ai"]
    style: str
    return_pct: float
    win_rate: int
    battles: int
    profit_factor: float | None = None


class TraderProfileRequest(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    style: Literal["Event-driven", "Momentum", "Contrarian", "Risk-first"] = "Event-driven"
    risk_appetite: int = Field(default=50, ge=10, le=90)
    holding_period: Literal["1H", "6H", "24H", "7D", "30D"] = "24H"
    assets: list[str] = Field(default_factory=lambda: ["rNVDA", "rTSLA", "rAAPL"])


class TraderProfile(TraderProfileRequest):
    id: str
    created_at: str
    updated_at: str
    mode: Literal["virtual-only"] = "virtual-only"


class BattleReview(BaseModel):
    battle_id: str
    generated_at: str
    winner: Literal["user", "ai", "draw"]
    user_result_pct: float
    ai_result_pct: float
    lesson: str
    what_worked: list[str] = Field(default_factory=list)
    what_failed: list[str] = Field(default_factory=list)
    next_rule: str
    source: str


class CalibrationBucket(BaseModel):
    bucket: str
    stated_midpoint: float
    n: int
    win_rate: float | None = None


class TrackRecord(BaseModel):
    settled_battles: int
    scored_battles: int
    min_settled_battles: int
    insufficient_data: bool
    win_rate: float
    brier_score: float | None = None
    brier_baseline: float | None = None
    curve: list[CalibrationBucket] = Field(default_factory=list)
    disclaimer: str
