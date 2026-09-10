# AlphaArena backend

FastAPI service for the real AlphaArena integrations.

## Current live integration

The first production slice uses Bitget UTA v3 public market data for Reality/tokenized U.S. stock pairs. The frontend polls this API and merges live price/candle fields into the Version 4 visual system.

## Local development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The frontend expects `VITE_API_BASE_URL=http://localhost:8000` during local development.
