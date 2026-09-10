from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.schemas import BattleCreateRequest, MarketTwinRequest, NightWatchRequest
from app.services.arena import arena_service
from app.services.bitget import BitgetError, bitget_market
from app.services.market_twin import market_twin
from app.services.nightwatch import nightwatch
from app.services.pulse import pulse_service
from app.services.storage import store

app = FastAPI(
    title="AlphaArena API",
    version="0.2.0",
    description="Backend for AlphaArena NightWatch, MarketTwin and virtual-capital Arena.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "alphaarena-api", "version": "0.2.0"}


@app.get("/api/integrations/status")
async def integration_status() -> dict[str, object]:
    return {
        "data": {
            "bitget": {"configured": True, "mode": "public Reality market data"},
            "bitgetSignal": {"configured": bool(settings.bitget_signal_mcp_url), "mode": "public MCP"},
            "qwen": {"configured": settings.qwen_enabled, "model": settings.qwen_model},
            "vibeTrading": {"configured": settings.vibe_enabled, "mode": "streamable HTTP MCP sidecar"},
            "mongodb": {"configured": bool(settings.mongodb_uri), "fallback": "in-memory"},
            "realMoneyTrading": {"configured": False, "mode": "disabled by product design"},
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
    try:
        return {"data": await pulse_service.events()}
    except BitgetError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/nightwatch/analyze")
async def analyze_thesis(request: NightWatchRequest) -> dict[str, object]:
    try:
        report = await nightwatch.analyze(request)
        await store.save("analyses", report["id"], report)
        return {"data": report}
    except BitgetError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/twin/simulate")
async def simulate_scenario(request: MarketTwinRequest) -> dict[str, object]:
    try:
        result = await market_twin.simulate(request)
        await store.save("scenarios", result["id"], result)
        return {"data": result}
    except BitgetError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/arena/battles")
async def create_battle(request: BattleCreateRequest) -> dict[str, object]:
    try:
        return {"data": await arena_service.create_battle(request)}
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


@app.get("/api/arena/portfolio")
async def portfolio() -> dict[str, object]:
    return {"data": await arena_service.portfolio()}


@app.get("/api/arena/leaderboard")
async def leaderboard() -> dict[str, object]:
    return {"data": await arena_service.leaderboard()}
