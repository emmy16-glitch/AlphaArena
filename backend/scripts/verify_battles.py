"""Verify AlphaArena paper-battle settlement hashes.

Usage:
    python backend/scripts/verify_battles.py samples/paper-log.json
    python backend/scripts/verify_battles.py --csv samples/paper-log.csv

Recomputes SHA-256 over the canonical settlement payload and prints PASS/FAIL
per battle. Exit non-zero if any settled battle fails verification.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from pathlib import Path


def canonical(battle: dict) -> str:
    payload = {
        "id": str(battle.get("battle_id") or battle.get("id")),
        "symbol": str(battle.get("asset") or battle.get("symbol")),
        "user_side": str(battle.get("direction") or battle.get("user_side")),
        "ai_side": str(battle.get("opponent_side") or battle.get("ai_side")),
        "stake": round(float(battle.get("stake") or 0), 2),
        "entry_price": float(battle.get("entry_price") or 0),
        "settled_price": float(battle.get("exit_price") or battle.get("settled_price") or 0),
        "created_at": str(battle.get("timestamp") or battle.get("created_at")),
        "settled_at": str(battle.get("settled_at")),
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    use_csv = "--csv" in sys.argv
    if not args:
        print("usage: verify_battles.py [--csv] <file>", file=sys.stderr)
        return 2
    path = Path(args[0])
    if use_csv:
        with path.open(encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
    else:
        rows = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(rows, dict) and "data" in rows:
            rows = rows["data"]
    failures = 0
    for row in rows:
        if str(row.get("status")) != "settled":
            print(f"SKIP {row.get('battle_id')}: not settled")
            continue
        expected = hashlib.sha256(canonical(row).encode()).hexdigest()
        stored = str(row.get("settlement_hash") or "")
        ok = expected == stored
        print(f"{'PASS' if ok else 'FAIL'} {row.get('battle_id')}: {stored[:12]}...")
        if not ok:
            failures += 1
    print(f"{len(rows)} battles checked, {failures} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
