"""Pull a year of SEAP construction awards (CPV division 45) for the adoption model.

Read-only against SEAP; nothing is written to the database. Output goes to
backend/data/raw/ (git-ignored, we do not commit tender data dumps):

  awards_45_12m.json   every award in the window: id, date, value, authority
  winners_sample.json  winner CIF and offers for a random sample of those awards

The list endpoint has no winner, so winners come from the award print PDF, one
request each; hence a sample. Run from the repo root:

    backend/.venv/Scripts/python backend/scripts/collect_seap_market.py [months] [sample]
"""

import asyncio
import json
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.adapters.romania_seap.adapter import RomaniaSeapAdapter

RAW = ROOT / "backend" / "data" / "raw"
DIVISION = "45"


async def main(months: int, sample_size: int) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    adapter = RomaniaSeapAdapter()
    end = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start = end - timedelta(days=30 * months)

    awards: dict[str, dict] = {}
    cursor = start
    while cursor < end:
        nxt = min(cursor + timedelta(days=7), end)
        for a in await adapter.fetch_awards(cpv_codes=[DIVISION], start=cursor, end=nxt):
            awards[a.external_id] = {
                "id": a.external_id,
                "date": a.award_date.date().isoformat() if a.award_date else None,
                "value": a.contract_value,
                "authority": a.contracting_authority,
            }
        print(f"{cursor.date()} -> {nxt.date()}: {len(awards)} awards so far", flush=True)
        cursor = nxt
    (RAW / "awards_45_12m.json").write_text(json.dumps(list(awards.values())), encoding="utf-8")

    random.seed(11)
    ids = random.sample(list(awards), min(sample_size, len(awards)))
    winners = []
    for i, ca_id in enumerate(ids, 1):
        try:
            d = await adapter.fetch_award_detail(ca_id)
        except Exception as exc:  # noqa: BLE001  one bad PDF must not end the run
            print(f"  {ca_id}: {type(exc).__name__}", flush=True)
            continue
        if d and d.winner_cif:
            winners.append(
                {"id": ca_id, "cif": d.winner_cif, "name": d.winner_name, "offers": d.offers_received}
            )
        if i % 50 == 0:
            print(f"winners {i}/{len(ids)} ({len(winners)} parsed)", flush=True)
            (RAW / "winners_sample.json").write_text(json.dumps(winners), encoding="utf-8")
    (RAW / "winners_sample.json").write_text(json.dumps(winners), encoding="utf-8")
    print(f"done: {len(awards)} awards, {len(winners)} winners parsed")


if __name__ == "__main__":
    asyncio.run(main(int(sys.argv[1]) if len(sys.argv) > 1 else 12, int(sys.argv[2]) if len(sys.argv) > 2 else 600))
