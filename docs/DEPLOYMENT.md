# Deployment

> **Live demo:** https://alphaarena.vercel.app

This runbook covers the three supported deployment shapes: Vercel (live demo), Docker Compose (full research stack), and direct Uvicorn (backend iteration). It also covers the optional MongoDB Atlas persistence.

## 1. Vercel (live demo)

**URL:** https://alphaarena.vercel.app

### How it is wired

| Piece | Source |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Framework | `vite` |
| Serverless API entry | `api/index.py` (re-exports `backend/app/main.py`) |
| Rewrite `/api/:path*` | → `/api/index.py` |
| Rewrite everything else | → `/index.html` (SPA fallback) |

Configuration lives in [`vercel.json`](../vercel.json). The frontend uses hash/history navigation, so browser Back works without extra server-side routing.

### Deploy / redeploy

```bash
# From the repository root (Vercel CLI must be logged in: `vercel login`)
vercel            # preview deployment
vercel --prod     # promote to production (https://alphaarena.vercel.app)

# Non-interactive alternative (CI): create a token in Vercel Dashboard →
# Settings → Tokens, then
vercel --prod --yes --token "$VERCEL_TOKEN"
```

Or connect the GitHub repo (`emmy16-glitch/AlphaArena`) in the Vercel dashboard for automatic preview + production deploys per push.

> **Note:** `vercel whoami` must report a logged-in account before deploying. If the domain instead serves an unrelated app (CRA-style `/static/js/main.*.js` bundle, `/api/health` returning HTML instead of JSON), the Vercel project is not deployed from this repo yet — run `vercel login && vercel --prod` from the repository root to claim it.

### Vercel environment variables

Set these in **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | No | Leave unset to use the bundled `/api` rewrite; set only when the API lives on a different host |
| `QWEN_API_KEY` | No | Enables optional Groq-hosted Qwen synthesis; empty = deterministic fallback |
| `AI_PROVIDER` | No | Default `groq` |
| `QWEN_BASE_URL` | No | Default `https://api.groq.com/openai/v1` |
| `QWEN_MODEL` | No | Default `qwen/qwen3.8-27b` |
| `MONGODB_URI` | No | Enables shared persistence; empty = in-memory fallback |
| `MONGODB_DB` | No | Default `alphaarena` |
| `FRONTEND_ORIGINS` | Recommended | Comma-separated allowed origins, e.g. `https://alphaarena.vercel.app` |
| `VIBE_MCP_URL` | No | Usually unavailable on Vercel serverless; product degrades to labelled fallback |
| `BITGET_SIGNAL_MCP_URL` | No | Default `https://datahub.noxiaohao.com/mcp` |

> The serverless API has a `maxDuration` of 10s (`vercel.json → functions`). Long upstream research calls degrade to fast, labelled fallbacks instead of holding the request open — this is intentional (see [ARCHITECTURE.md](ARCHITECTURE.md)).

### Smoke-test the live build

```text
https://alphaarena.vercel.app/                 # landing → enter product
https://alphaarena.vercel.app/api/health       # {"status": ...}
https://alphaarena.vercel.app/api/budget/status
https://alphaarena.vercel.app/api/integrations/status
https://alphaarena.vercel.app/api/market/assets
https://alphaarena.vercel.app/api/session/now  # {"session": "listed"|"shadow", ...} (Shadow Session)
https://alphaarena.vercel.app/#/morgue         # Thesis Morgue (settled dead theses)
```

Shadow Session adds **no new environment variables** — it reuses the existing Bitget market feed and candle endpoint, the same settlement system, and the same `settlement_hash` freeze.

For the full rehearsed flow, follow [JUDGE_DEMO.md](JUDGE_DEMO.md) against the live URL.

## 2. Docker Compose (full research stack)

Best local option when you want the Vibe-Trading sidecar:

```bash
cp backend/.env.example backend/.env
# Optional: put QWEN_API_KEY in backend/.env for Groq-hosted Qwen synthesis.
docker compose up --build
```

| Service | Image | Port | Purpose |
| --- | --- | --- | --- |
| `vibe` | `backend/Dockerfile.vibe` (`vibe-trading-ai==0.1.15`) | `127.0.0.1:8900` | Research-only MCP sidecar, shell tools disabled |
| `api` | `backend/Dockerfile` | `8000` | FastAPI (`VIBE_MCP_URL=http://vibe:8900/mcp`) |

Frontend (separate terminal):

```bash
npm install
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

## 3. Direct Uvicorn (backend iteration)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Interactive API: `http://127.0.0.1:8000/docs`
Diagnostics: `/api/health`, `/api/integrations/status`, `/api/budget/status`

## 4. Optional MongoDB Atlas persistence

1. Create a free Atlas cluster and database user.
2. Set `MONGODB_URI` (and optionally `MONGODB_DB=alphaarena`) in `backend/.env` (Compose/local) or Vercel project env (live).
3. Restart. Empty `MONGODB_URI` = in-memory fallback; the product stays functional.

Storage is abstracted in `backend/app/services/storage.py`, so no code change is needed to switch modes.

## 5. Production checklist (before judging)

- [ ] `https://alphaarena.vercel.app/` loads with no console errors.
- [ ] `/api/health` and `/api/budget/status` respond (paper-only, background LLM = 0).
- [ ] Pulse shows live vs. preview labelling truthfully.
- [ ] NightWatch → MarketTwin → Arena → Review flow rehearsed per [JUDGE_DEMO.md](JUDGE_DEMO.md).
- [ ] Shadow Session: one settled battle shows Listed/Shadow bars, the verbatim commitment sentence, and a **Verify freeze** that returns `hash matches`.
- [ ] Thesis Morgue loads at `/#/morgue` with no horizontal overflow on mobile.
- [ ] `FRONTEND_ORIGINS` includes the production URL.
- [ ] Secrets only in environment variables; no `.env` committed (see `.gitignore`).
- [ ] Release gate green: [QUALITY_CHECKLIST.md](QUALITY_CHECKLIST.md).

## Troubleshooting

| Symptom | Likely cause → fix |
| --- | --- |
| Vercel API 404 on `/api/...` | `vercel.json` rewrites missing → verify `api/index.py` exists and rewrites point at it |
| CORS errors from custom frontend | `FRONTEND_ORIGINS` does not include the frontend origin → add it, redeploy |
| Vibe/Signal sections say “unavailable” | Sidecar or upstream unreachable / cold cache → expected graceful degradation; check `/api/integrations/diagnostics` |
| Qwen features fall back to deterministic text | `QWEN_API_KEY` unset or budget fuse exhausted → check `/api/budget/status` |
| Data looks stale after backend deploy | `VIBE_CACHE_SECONDS` (900s) / `SIGNAL_CACHE_SECONDS` (300s) caches → wait or restart API |
