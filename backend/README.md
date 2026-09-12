# AlphaArena backend

FastAPI service for AlphaArena's evidence, stress-testing and paper-battle loop.

## Responsibilities

The backend owns the rules that should not depend on UI behavior:

- Bitget UTA v3 Reality market normalization,
- deterministic market/risk/scenario calculations,
- Vibe-Trading historical research normalization,
- optional Bitget Signal context,
- optional budget-fused Qwen 3.8 high-reasoning synthesis through Groq,
- virtual portfolio accounting,
- immutable paper-battle settlement,
- Shadow Session Listed/Shadow bucketing, kill verification and commitment hashing,
- post-battle review,
- lightweight background Pulse detection,
- integration/budget diagnostics,
- human-readable API error contracts.

It intentionally owns **no real-money exchange order route**.

## Local API development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Then open:

```text
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/api/health
http://127.0.0.1:8000/api/integrations/status
http://127.0.0.1:8000/api/budget/status
```

## Full research stack

From the repository root:

```bash
docker compose up --build
```

Compose starts:

- `vibe` — pinned Vibe-Trading MCP research sidecar on the internal network,
- `api` — AlphaArena FastAPI service on port `8000`.

The API receives `VIBE_MCP_URL=http://vibe:8900/mcp`. Vibe shell tools are disabled in the sidecar image.

## Optional services

The backend is deliberately resilient to missing optional services:

- empty `QWEN_API_KEY` → deterministic reasoning fallback,
- empty `MONGODB_URI` → in-memory storage fallback,
- empty `VIBE_MCP_URL` → no historical Vibe context, clearly reported,
- unavailable Bitget Signal → macro/news context omitted.

Bitget live market data is more fundamental: actions that require a fresh market price return a readable upstream-unavailable response when it cannot be obtained.

## Budget controls

Defaults:

```text
QWEN_DAILY_ATTEMPT_LIMIT=12
QWEN_MAX_ATTEMPTS_PER_REQUEST=2
QWEN_MAX_OUTPUT_TOKENS=3000
QWEN_RETRY_MAX_WAIT_SECONDS=10
QWEN_TIMEOUT_SECONDS=35
VIBE_CACHE_SECONDS=900
SIGNAL_CACHE_SECONDS=300
WATCHER_INTERVAL_SECONDS=60
ARENA_STARTING_CAPITAL=100000
```

The current hackathon provider settings are:

```text
AI_PROVIDER=groq
QWEN_BASE_URL=https://api.groq.com/openai/v1
QWEN_MODEL=qwen/qwen3.8-27b
```

The `QWEN_*` names identify the model family and remain backward-compatible. Diagnostics separately report `provider: groq`; they never expose credentials. Structured calls use JSON mode, hidden chain-of-thought, and Qwen 3.8's highest supported Groq reasoning effort (`high`). Transient failures retry at most three times and respect Groq's `Retry-After` header up to ten seconds; longer quota windows fail fast into the deterministic fallback. To make one optional live smoke request from the repository root, run `PYTHONPATH=backend backend/.venv/bin/python backend/scripts/check_ai_provider.py`.

The model counter is an AlphaArena per-process safety fuse, not provider billing information. `GET /api/budget/status` exposes the current application-side state.

## Tests

```bash
ruff check app tests
pytest -q
python -m compileall -q app
python -c "from app.main import app; print(app.version)"
```

The test suite includes mocked Qwen/Groq response and failure coverage plus policy tests for no Bitget trade route, no background model use, concurrent virtual-capital allocation, immutable settlement and readable validation errors. Normal CI never calls the live model provider.

## Source map

```text
app/main.py                    API routes + friendly problem handlers
app/config.py                  environment/budget configuration
app/schemas.py                 request/response contracts
app/services/bitget.py         Bitget Reality market adapter
app/services/vibe.py           Vibe research + historical calculations
app/services/signal.py         Bitget Signal MCP adapter
app/services/qwen.py           optional model synthesis
app/services/budget.py         application-side model-call fuse
app/services/analytics.py      deterministic market/scenario math
app/services/nightwatch.py     adversarial thesis analysis
app/services/market_twin.py    what-if scenario engine
app/services/arena.py          paper ledger + settlement
app/services/review.py         post-battle learning
app/services/shadow.py         Listed/Shadow boundary + move attribution + kill_check
app/services/pulse.py          market event derivation
app/services/watcher.py        cheap always-on Pulse refresh
app/services/storage.py        MongoDB/in-memory repository abstraction
```

For deeper implementation notes, see the repository-level `docs/` directory.
