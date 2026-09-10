from __future__ import annotations

from typing import Literal

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


class ParsedShock(BaseModel):
    driver: str
    category: str
    magnitude: float
    unit: str
    direction: Literal["up", "down", "mixed"]


class TwinImpact(BaseModel):
    symbol: str
    current_price: float
    impact_pct: float
    lower_pct: float
    upper_pct: float
    confidence: int
    model: str | None = None
    beta_to_qqq: float | None = None


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
    stake: float = Field(default=10_000, gt=0, le=100_000)
    duration_hours: int = Field(default=24, ge=1, le=168)
    opponent: str = Field(default="NightWatch", min_length=1, max_length=80)


class BattleView(BaseModel):
    id: str
    symbol: str
    thesis: str
    user_side: Direction
    ai_side: Direction
    opponent: str
    stake: float
    entry_price: float
    current_price: float
    user_pnl_pct: float
    ai_pnl_pct: float
    created_at: str
    expires_at: str
    settled_at: str | None = None
    settled_price: float | None = None
    status: Literal["live", "settled"]
    source: str = "bitget"


class PortfolioSummary(BaseModel):
    starting_capital: float
    net_value: float
    free_capital: float
    deployed_capital: float
    return_pct: float
    open_battles: int
    settled_battles: int


class LeaderRow(BaseModel):
    rank: int
    name: str
    type: Literal["human", "ai"]
    style: str
    return_pct: float
    win_rate: int
    battles: int


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
