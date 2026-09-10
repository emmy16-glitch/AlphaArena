from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.services.bitget import BitgetError, bitget_market

app = FastAPI(
    title="AlphaArena API",
    version="0.1.0",
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
    return {"status": "ok", "service": "alphaarena-api"}


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
