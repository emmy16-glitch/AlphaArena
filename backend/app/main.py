from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.schemas import BattleCreateRequest, MarketTwinRequest, NightWatchRequest, TraderProfileRequest
from app.services.arena import ArenaError, arena_service
from app.services.bitget import BitgetError, bitget_market
from app.services.budget import qwen_budget
from app.services.market_twin import market_twin
from app.services.nightwatch import nightwatch
from app.services.pulse import pulse_service
from app.services.review import review_service
from app.services.signal import bitget_signal
from app.services.storage import store
from app.services.traders import trader_service
from app.services.vibe import vibe_research
from app.services.watcher import pulse_watcher


@asynccontextmanager
async def lifespan(_: FastAPI):
    await pulse_watcher.start()
    try:
        yield
    finally:
        await pulse_watcher.stop()


app = FastAPI(
    title="AlphaArena API",
    version="0.5.0",
    description="Evidence-first backend for AlphaArena NightWatch, MarketTwin and virtual-capital Arena.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def _problem(status: int, code: str, message: str, action: str, retryable: bool = False) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "action": action, "retryable": retryable}},
    )


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, __: RequestValidationError) -> JSONResponse:
    return _problem(
        422,
        "CHECK_INPUT",
        "Some information is missing or outside the allowed range.",
        "Check your entries and try again.",
    )


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = str(exc.detail)
    if exc.status_code == 404:
        return _problem(404, "NOT_FOUND", "We couldn’t find that item.", "Go back and choose an available item.")
    if exc.status_code == 409 and detail.startswith("Virtual stake"):
        return _problem(
            409,
            "VIRTUAL_BUDGET",
            "That virtual stake is larger than your free paper balance.",
            "Lower the stake or wait for an open paper battle to settle.",
        )
    if exc.status_code == 409 and detail.startswith("Battle review"):
        return _problem(
            409,
            "BATTLE_STILL_LIVE",
            "This paper battle is still running.",
            "Come back after the timer ends to generate the review.",
        )
    if exc.status_code in {502, 503, 504}:
        return _problem(
            exc.status_code,
            "UPSTREAM_UNAVAILABLE",
            "Live market data or research is taking longer than usual.",
            "Try again in a moment. Your paper balance was not changed.",
            True,
        )
    if exc.status_code == 429:
        return _problem(429, "TOO_MANY_REQUESTS", "That’s moving too fast.", "Wait a moment and try again.", True)
    return _problem(
        exc.status_code,
        "REQUEST_FAILED",
        "We couldn’t complete that action.",
        "Try again.",
        exc.status_code >= 500,
    )


@app.exception_handler(Exception)
async def unexpected_error(_: Request, __: Exception) -> JSONResponse:
    return _problem(
        500,
        "TEMPORARY_ERROR",
        "AlphaArena hit a temporary problem.",
        "Nothing was submitted. Try again in a moment.",
        True,
    )


@app.get("/api/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "alphaarena-api",
        "version": "0.5.0",
        "storage": store.mode,
        "watcher": pulse_watcher.status,
    }


@app.get("/api/budget/status")
async def budget_status() -> dict[str, object]:
    return {
        "data": {
            "virtual_capital": float(settings.arena_starting_capital),
            "real_money_trading": False,
            "background_llm_calls": 0,
            "qwen": await qwen_budget.status(),
            "vibe_trading": {
                "mode": "research-only MCP sidecar",
                "shell_tools_enabled": False,
                "cache_seconds": max(1, settings.vibe_cache_seconds),
            },
        }
    }


@app.get("/api/integrations/status")
async def integration_status() -> dict[str, object]:
    return {
        "data": {
            "bitget": {"configured": True, "mode": "Reality public-market adapter"},
            "bitgetSignal": {"configured": bool(settings.bitget_signal_mcp_url), "mode": "public MCP"},
            "qwen": {"configured": settings.qwen_enabled, "model": settings.qwen_model},
            "vibeTrading": {"configured": settings.vibe_enabled, "mode": "research-only Streamable HTTP MCP sidecar"},
            "mongodb": {"configured": bool(settings.mongodb_uri), "fallback": "in-memory"},
            "watcher": pulse_watcher.status,
            "realMoneyTrading": {"configured": False, "mode": "disabled by product design"},
        }
    }


@app.get("/api/integrations/diagnostics")
async def integration_diagnostics() -> dict[str, object]:
    async def bitget_check() -> dict[str, object]:
        try:
            instruments = await bitget_market.get_reality_instruments()
            return {"connected": True, "reality_instruments": len(instruments)}
        except Exception:
            return {"connected": False, "reason": "Bitget public market data unavailable"}

    bitget_result, vibe_result, signal_result = await asyncio.gather(
        bitget_check(), vibe_research.health(), bitget_signal.health()
    )
    return {
        "data": {
            "bitget": bitget_result,
            "vibeTrading": vibe_result,
            "bitgetSignal": signal_result,
            "qwen": {"configured": settings.qwen_enabled, "model": settings.qwen_model, "budget": await qwen_budget.status()},
            "storage": {"mode": store.mode},
            "watcher": pulse_watcher.status,
        }
    }


@app.get("/api/market/instruments/reality")
async def reality_instruments() -> dict[str, object]:
    try:
        return {"data": await bitget_market.get_reality_instruments()}
    except BitgetError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/market/assets")
async def market_assets() -> dict[str, object]:
    try:
        return {"data": await bitget_market.get_assets()}
    except BitgetError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/market/assets/{symbol}")
async def market_asset(symbol: str) -> dict[str, object]:
    try:
        return {"data": await bitget_market.get_asset(symbol)}
    except BitgetError as exc:
        status = 404 if "Unsupported" in str(exc) else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc


@app.get("/api/pulse")
async def pulse() -> dict[str, object]:
    if pulse_watcher.latest:
        return {"data": pulse_watcher.latest}
    try:
        return {"data": await pulse_service.events()}
    except BitgetError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/pulse/status")
async def pulse_status() -> dict[str, object]:
    return {"data": pulse_watcher.status}


@app.get("/api/pulse/history")
async def pulse_history() -> dict[str, object]:
    return {"data": await store.list("pulse_snapshots", limit=30)}


@app.post("/api/pulse/run")
async def pulse_run_once() -> dict[str, object]:
    try:
        return {"data": await pulse_watcher.run_once()}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/research/vibe/{symbol}")
async def vibe_research_snapshot(symbol: str) -> dict[str, object]:
    if symbol not in {"rNVDA", "rTSLA", "rAAPL", "rMSFT", "rAMD", "rQQQ"}:
        raise HTTPException(status_code=404, detail="Unsupported AlphaArena symbol")
    return {"data": await vibe_research.snapshot(symbol)}


@app.post("/api/nightwatch/analyze")
async def analyze_thesis(request: NightWatchRequest) -> dict[str, object]:
    try:
        report = await nightwatch.analyze(request)
        await store.save("analyses", report["id"], report)
        return {"data": report}
    except BitgetError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/nightwatch/history")
async def analysis_history() -> dict[str, object]:
    return {"data": await store.list("analyses", limit=50)}


@app.post("/api/twin/simulate")
async def simulate_scenario(request: MarketTwinRequest) -> dict[str, object]:
    try:
        result = await market_twin.simulate(request)
        await store.save("scenarios", result["id"], result)
        return {"data": result}
    except BitgetError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/twin/history")
async def scenario_history() -> dict[str, object]:
    return {"data": await store.list("scenarios", limit=50)}


@app.post("/api/arena/battles")
async def create_battle(request: BattleCreateRequest) -> dict[str, object]:
    try:
        return {"data": await arena_service.create_battle(request)}
    except ArenaError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except BitgetError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/arena/battles")
async def list_battles() -> dict[str, object]:
    return {"data": await arena_service.list_battles()}


@app.get("/api/arena/battles/{battle_id}")
async def get_battle(battle_id: str) -> dict[str, object]:
    battle = await arena_service.get_battle(battle_id)
    if battle is None:
        raise HTTPException(status_code=404, detail="Battle not found")
    return {"data": battle}


@app.post("/api/arena/battles/{battle_id}/review")
async def review_battle(battle_id: str) -> dict[str, object]:
    battle = await arena_service.get_battle(battle_id)
    if battle is None:
        raise HTTPException(status_code=404, detail="Battle not found")
    if battle.get("status") != "settled":
        raise HTTPException(status_code=409, detail="Battle review is available after the battle settles")
    return {"data": await review_service.review(battle)}


@app.get("/api/arena/portfolio")
async def portfolio() -> dict[str, object]:
    return {"data": await arena_service.portfolio()}


@app.get("/api/arena/leaderboard")
async def leaderboard() -> dict[str, object]:
    return {"data": await arena_service.leaderboard()}


@app.post("/api/traders")
async def create_trader(request: TraderProfileRequest) -> dict[str, object]:
    return {"data": await trader_service.create(request)}


@app.get("/api/traders")
async def list_traders() -> dict[str, object]:
    return {"data": await trader_service.list()}
