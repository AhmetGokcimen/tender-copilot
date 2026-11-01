"""Leave-one-out back-test of core.scoring on real SEAP awards.

For every company with 2+ awards in the local database, hide one award, build a
profile from the others (main CPVs, capacity = largest other contract), and rank
the hidden award's tender among all open tenders. Run from the repo root:

    backend/.venv/Scripts/python backend/scripts/backtest_matching.py

Reads backend/data/app.db read-only. Small sample: treat as a signal, not proof.
"""
import json
import random
import sqlite3
import statistics as st
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from types import SimpleNamespace as NS

from backend.core.scoring import evaluate

c = sqlite3.connect(f"file:{(ROOT / 'backend' / 'data' / 'app.db').as_posix()}?mode=ro", uri=True)
c.row_factory = sqlite3.Row
def cpv(s): return json.loads(s) if s else []

tenders = []
for r in c.execute("select * from tender"):
    t = NS(title=r["title"], cpv_codes=cpv(r["cpv_codes"]),
        estimated_value=r["estimated_value"], submission_deadline=None,
        contracting_authority=r["contracting_authority"], external_id=r["external_id"])
    tenders.append(t)
by_title = {}
for t in tenders: by_title.setdefault(t.title.strip().lower(), t)

awards = [dict(r) for r in c.execute("select * from award where winner_cif is not null and winner_name not like 'Sistemul%'")]
for a in awards: a["cpv"] = cpv(a["cpv_codes"])
winners = {}
for a in awards: winners.setdefault(a["winner_cif"], []).append(a)

random.seed(7)
res = []
for cif, lst in winners.items():
    if len(lst) < 2: continue
    for i, held in enumerate(lst):
        tgt = by_title.get(held["title"].strip().lower())
        if not tgt or not tgt.cpv_codes: continue
        rest = [x for j, x in enumerate(lst) if j != i]
        core = sorted({x["cpv"][0] for x in rest if x["cpv"]})
        vals = [x["contract_value"] for x in rest if x["contract_value"]]
        if not core or not vals: continue
        prof = NS(cpv_codes=core, secondary_cpv_codes=[], annual_capacity=max(vals), blacklist_keywords=[])
        s_t = evaluate(tgt, prof).score
        pool = [t for t in tenders if t.external_id != tgt.external_id]
        scores = [evaluate(t, prof).score for t in pool]
        ge = sum(s >= s_t for s in scores); gt = sum(s > s_t for s in scores)
        rank = (gt + ge) / 2 + 1          # tie-averaged rank among len(pool)+1
        res.append({"cif": cif, "n": len(pool)+1, "rank": rank, "s_t": s_t, "share_hi": sum(s>=45 for s in scores)/len(scores)})
print("cases", len(res), "winners", len({r["cif"] for r in res}))
if res:
    pct = [r["rank"]/r["n"] for r in res]
    print("median rank percentile (lower=better; random=0.50)", round(st.median(pct),3))
    for k in (0.05, 0.10, 0.25):
        print(f"target in top {int(k*100)}%:", round(sum(p<=k for p in pct)/len(pct),3), "(random", k, ")")
    print("target scored >=45 (AI threshold):", round(sum(r["s_t"]>=45 for r in res)/len(res),3),
          "| avg share of pool scoring >=45:", round(st.mean(r["share_hi"] for r in res),3))
    print("target score 0:", round(sum(r["s_t"]==0 for r in res)/len(res),3))
