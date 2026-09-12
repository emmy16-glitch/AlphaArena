from __future__ import annotations

import httpx
import pytest

from app.main import app
from app.services import market_twin as twin_module
from app.services.market_twin import (
    _apply_side,
    _historical_impact,
    aggregate_portfolio_impact,
)
from app.services.storage import store


def _nasdaq_down() -> dict[str, object]:
    return {"driver": "Nasdaq 100", "category": "nasdaq", "magnitude": 5.0, "unit": "%", "direction": "down"}


def _calibration(paired: int, beta: float | None = 1.4) -> dict[str, object]:
    return {
        "beta_to_qqq": beta,
        "correlation_to_qqq": 0.8,
        "annualized_volatility_pct": 32.5,
        "observations": paired + 40,
        "paired_observations": paired,
    }


def test_apply_side_mirrors_and_zeroes() -> None:
    assert _apply_side(-4.0, -6.0, -2.0, "LONG") == (-4.0, -6.0, -2.0)
    assert _apply_side(-4.0, -6.0, -2.0, "SHORT") == (4.0, 2.0, 6.0)
    assert _apply_side(-4.0, -6.0, -2.0, "WAIT") == (0.0, 0.0, 0.0)


def test_aggregate_sums_leg_dollars_without_diversification() -> None:
    legs = [
        {"stake": 10000.0, "impact_pct": -4.0, "lower_pct": -6.0, "upper_pct": -2.0},
        {"stake": 5000.0, "impact_pct": 2.0, "lower_pct": 1.0, "upper_pct": 3.0},
    ]
    aggregate = aggregate_portfolio_impact(legs)
    assert aggregate["total_stake"] == 15000.0
    assert aggregate["impact_dollars"] == pytest.approx(-300.0)
    assert aggregate["lower_dollars"] == pytest.approx(-550.0)
    assert aggregate["upper_dollars"] == pytest.approx(-50.0)
    assert aggregate["impact_pct"] == pytest.approx(-2.0)
    assert aggregate["legs"] == 2
    assert "no diversification benefit" in aggregate["method"]


def test_aggregate_empty_portfolio_is_zero() -> None:
    aggregate = aggregate_portfolio_impact([])
    assert aggregate["total_stake"] == 0.0
    assert aggregate["impact_dollars"] == 0.0
    assert aggregate["impact_pct"] == 0.0


def test_historical_impact_exposes_measured_work() -> None:
    impact, lower, upper, confidence, model, calibrated, work = _historical_impact(
        "rNVDA", _nasdaq_down(), 60, 1.2, _calibration(60)
    )
    assert calibrated is True
    assert model == "Vibe-Trading measured beta"
    assert work["beta_used"] == pytest.approx(1.4)
    assert work["beta_source"] == "measured"
    assert work["paired_observations"] == 60
    assert work["observations_minimum"] == 20
    assert work["calibration_gate_passed"] is True
    assert work["fallback_reason"] is None
    assert work["short_volatility_pct"] == pytest.approx(1.2)
    assert work["annualized_volatility_pct"] == pytest.approx(32.5)
    assert lower < impact < upper


def test_historical_impact_states_prior_fallback_below_gate() -> None:
    impact, lower, upper, confidence, model, calibrated, work = _historical_impact(
        "rNVDA", _nasdaq_down(), 60, 1.2, _calibration(7, None)
    )
    assert calibrated is False
    assert model == "Assumption-based prior (uncalibrated)"
    assert work["beta_used"] is None
    assert work["beta_source"] == "prior"
    assert work["prior_beta"] == pytest.approx(1.55)
    assert work["paired_observations"] == 7
    assert work["fallback_reason"] == "fewer_than_20_paired_observations"


def test_historical_impact_non_nasdaq_uses_prior_openly() -> None:
    yields_up = {"driver": "Treasury yields", "category": "yields", "magnitude": 40.0, "unit": "bp", "direction": "up"}
    _, _, _, _, _, calibrated, work = _historical_impact("rNVDA", yields_up, 60, 0.5, _calibration(60))
    assert calibrated is False
    assert work["fallback_reason"] == "non_nasdaq_category_uses_prior"


async def test_portfolio_endpoint_aggregates_legs(monkeypatch: pytest.MonkeyPatch) -> None:
    await store.clear_memory()

    async def fake_asset(symbol: str) -> dict[str, object]:
        prices = {"rNVDA": 100.0, "rAAPL": 200.0}
        return {
            "symbol": symbol,
            "price": prices[symbol],
            "changePct": 0.0,
            "changeAbs": 0.0,
            "high24": prices[symbol],
            "low24": prices[symbol],
            "spark": [99.0, 100.0, 101.0, 100.5, 102.0, 101.0],
        }

    async def fake_calibrations(symbols: list[str]) -> dict[str, dict[str, object]]:
        return {symbol: _calibration(60) for symbol in symbols}

    monkeypatch.setattr(twin_module.bitget_market, "get_asset", fake_asset)
    monkeypatch.setattr(type(twin_module.vibe_research), "enabled", property(lambda self: True))
    monkeypatch.setattr(twin_module.vibe_research, "calibrations", fake_calibrations)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/twin/portfolio",
            json={
                "prompt": "Nasdaq falls 5%",
                "positions": [
                    {"symbol": "rNVDA", "side": "LONG", "stake": 10000},
                    {"symbol": "rAAPL", "side": "SHORT", "stake": 5000},
                ],
                "severity": 60,
                "duration": "24H",
            },
        )
    assert response.status_code == 200
    payload = response.json()["data"]
    assert len(payload["legs"]) == 2
    long_leg, short_leg = payload["legs"]
    assert long_leg["impact_pct"] < 0
    assert short_leg["impact_pct"] > 0
    assert short_leg["impact_dollars"] == pytest.approx(round(5000 * short_leg["impact_pct"] / 100, 2))
    aggregate = payload["aggregate"]
    assert aggregate["total_stake"] == 15000.0
    assert aggregate["impact_dollars"] == pytest.approx(
        round(long_leg["impact_dollars"] + short_leg["impact_dollars"], 2)
    )
    assert long_leg["paired_observations"] == 60
    assert payload["transparency"]["calibration_minimum_observations"] == 20


async def test_portfolio_endpoint_rejects_empty_positions() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/twin/portfolio",
            json={"prompt": "Nasdaq falls 5%", "positions": [], "severity": 60, "duration": "24H"},
        )
    assert response.status_code == 422
