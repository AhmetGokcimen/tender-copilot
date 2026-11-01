"""Adoption forecast for Licits: a Bass diffusion model fed by real SEAP data.

Every market input is measured from a year of SEAP construction awards
(collect_seap_market.py); every behavioural input is a stated prior with a range
taken from published diffusion benchmarks. The model is run 5,000 times with the
inputs drawn from those ranges, so the output is a band, not a single number.

    backend/.venv/Scripts/python backend/scripts/adoption_model.py

Writes docs/validation/adoption_inputs.json, adoption_results.json and
adoption_fan.svg. Read docs/ADOPTION_MODEL.md before quoting any number.
"""

import json
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "backend" / "data" / "raw"
OUT = ROOT / "docs" / "validation"

RUNS = 5000
MONTHS = 36
LAUNCH_MONTH = 12  # calendar month of month 1 (Dec 2026); seasonality starts here
PRICES = np.array([199.0, 349.0, 499.0])  # Start, Growth, Pro, RON per month ex-VAT
SEED = 2026


# --------------------------------------------------------------------------- data


def load() -> tuple[list[dict], list[dict]]:
    awards = json.loads((RAW / "awards_45_12m.json").read_text(encoding="utf-8"))
    winners = json.loads((RAW / "winners_sample.json").read_text(encoding="utf-8"))
    return awards, winners


def heaps_fit(winners: list[dict], rng: np.random.Generator, boot: int = 300) -> np.ndarray:
    """Distinct winners D(n) = k * n**beta (Heaps' law) as awards n accumulate.

    Repeat winners make D grow slower than n, so annual distinct winners are not
    simply annual awards. Fitted on random orderings of the sample; the bootstrap
    over awards gives the uncertainty. Returns array of (log_k, beta)."""
    cifs = np.array([w["cif"] for w in winners])
    n_total = len(cifs)
    sizes = np.unique(np.geomspace(30, n_total, 14).astype(int))
    fits = []
    for _ in range(boot):
        res = rng.choice(n_total, n_total, replace=True)
        pool = cifs[res]
        ys = []
        for n in sizes:
            ds = []
            for _ in range(8):
                ds.append(len(set(pool[rng.permutation(n_total)[:n]])))
            ys.append(np.mean(ds))
        beta, logk = np.polyfit(np.log(sizes), np.log(ys), 1)
        fits.append((logk, beta))
    return np.array(fits)


def market_inputs(awards: list[dict], winners: list[dict], rng: np.random.Generator) -> dict:
    dates = [date.fromisoformat(a["date"]) for a in awards if a["date"]]
    span_days = (max(dates) - min(dates)).days + 1
    a_year = len(dates) * 365 / span_days

    by_month: dict[int, int] = defaultdict(int)
    for d in dates:
        by_month[d.month] += 1
    mean_m = np.mean(list(by_month.values()))
    # One observation per calendar month is noisy: shrink half-way to flat.
    season = {m: 0.5 + 0.5 * by_month[m] / mean_m for m in range(1, 13)}

    values = np.array(sorted(a["value"] for a in awards if a["value"]))
    offers = np.array([w["offers"] for w in winners if w.get("offers")])
    counts = Counter(w["cif"] for w in winners)
    fits = heaps_fit(winners, rng)

    return {
        "window": [min(dates).isoformat(), max(dates).isoformat()],
        "awards_in_window": len(dates),
        "awards_per_year": round(a_year),
        "monthly_award_counts": {str(m): by_month[m] for m in sorted(by_month)},
        "season_index": {str(m): round(season[m], 3) for m in season},
        "award_value_quantiles_ron": {
            q: float(np.quantile(values, q / 100)) for q in (10, 25, 50, 75, 90)
        },
        "winner_sample": {
            "awards": len(winners),
            "distinct_winners": len(counts),
            "winners_with_2plus": sum(c >= 2 for c in counts.values()),
            "mean_offers_per_award": round(float(offers.mean()), 2),
            "single_bidder_share": round(float((offers == 1).mean()), 3),
        },
        "heaps_beta_p5_p50_p95": [round(float(np.percentile(fits[:, 1], q)), 3) for q in (5, 50, 95)],
        "_fits": fits,
        "_values": values,
        "_season": season,
        "_a_year": a_year,
        "_mean_offers": float(offers.mean()),
    }


# ----------------------------------------------------------------------- the model


def run_model(inp: dict, rng: np.random.Generator) -> dict:
    fits, values, season = inp["_fits"], inp["_values"], inp["_season"]
    a_year, mean_offers = inp["_a_year"], inp["_mean_offers"]

    # ---- market size, per run: awards -> distinct winners -> bidders -> serviceable -> reachable
    idx = rng.integers(0, len(fits), RUNS)
    winners_year = np.minimum(np.exp(fits[idx, 0]) * a_year ** fits[idx, 1], a_year)
    bidder_mult = np.minimum(rng.triangular(1.5, 2.5, 3.5, RUNS), mean_offers)
    bidders = winners_year * bidder_mult
    cap_ron = np.exp(rng.uniform(np.log(10e6), np.log(50e6), RUNS))  # "small and mid-sized"
    share_fit = np.searchsorted(values, cap_ron) / len(values)
    reachable = rng.beta(3, 7, RUNS)  # share that would ever pay for a tool like this
    market = bidders * share_fit * reachable

    # ---- behaviour priors (Bass 1969; Sultan, Farley, Lehmann 1990 meta-analysis: p~0.03, q~0.38)
    p = np.exp(rng.uniform(np.log(0.004), np.log(0.03), RUNS))  # invite-only starts below the mean
    q = rng.uniform(0.2, 0.5, RUNS)
    trial_to_paid = rng.beta(5, 15, RUNS)  # mean 0.25
    churn = rng.uniform(0.02, 0.06, RUNS)  # monthly, small-business SaaS
    invites0 = rng.uniform(15, 40, RUNS)
    invite_growth = rng.uniform(1.05, 1.25, RUNS)
    open_month = rng.integers(9, 16, RUNS)  # invites lifted
    mix = rng.dirichlet([4, 5, 1], RUNS)  # Start / Growth / Pro
    arpu = mix @ PRICES

    # Pool = firms that are not paying customers today. Trial starters convert at
    # trial_to_paid; the rest, and later churners, go back into the pool (a plain Bass
    # model never lets anyone leave, which would make customers fall once it saturates).
    # Word of mouth comes from paying customers only.
    paid = np.zeros(RUNS)
    trials = np.zeros(RUNS)
    paid_path = np.zeros((MONTHS + 1, RUNS))
    for t in range(1, MONTHS + 1):
        s = season[(LAUNCH_MONTH + t - 2) % 12 + 1]
        demand = (p * s + q * paid / market) * np.maximum(market - paid, 0)
        cap = np.where(t < open_month, invites0 * invite_growth ** (t - 1), np.inf)
        new = np.minimum(demand, cap)
        trials += new
        paid = paid * (1 - churn) + new * trial_to_paid
        paid_path[t] = paid
    adopters = trials

    mrr = paid_path * arpu
    inputs = {
        "market_size": market, "winners_per_year": winners_year, "bidder_multiplier": bidder_mult,
        "value_cap_ron": cap_ron, "reachable_share": reachable, "p": p, "q": q,
        "trial_to_paid": trial_to_paid, "churn": churn, "invites_start": invites0,
        "invite_growth": invite_growth, "open_month": open_month.astype(float), "arpu": arpu,
    }
    return {"paid": paid_path, "mrr": mrr, "inputs": inputs, "adopters": adopters, "market": market}


def rank(x: np.ndarray) -> np.ndarray:
    return np.argsort(np.argsort(x)).astype(float)


def summarize(res: dict) -> dict:
    q = lambda a, m: [round(float(np.percentile(a[m], k))) for k in (10, 50, 90)]
    out = {"market_size_p10_p50_p90": [round(float(np.percentile(res["market"], k))) for k in (10, 50, 90)]}
    for m in (6, 12, 24, 36):
        out[f"month_{m}"] = {
            "paid_customers": q(res["paid"], m),
            "mrr_ron": q(res["mrr"], m),
            "arr_ron": [v * 12 for v in q(res["mrr"], m)],
        }
    out["penetration_of_market_at_36"] = [
        round(float(np.percentile(res["paid"][36] / res["market"], k)), 3) for k in (10, 50, 90)
    ]
    out["p_at_least_100_paid_at_12"] = round(float((res["paid"][12] >= 100).mean()), 3)
    out["p_at_least_100_paid_at_24"] = round(float((res["paid"][24] >= 100).mean()), 3)
    target = rank(res["paid"][24])
    out["rank_correlation_with_paid_at_24"] = dict(
        sorted(
            ((k, round(float(np.corrcoef(rank(v), target)[0, 1]), 2)) for k, v in res["inputs"].items()),
            key=lambda kv: -abs(kv[1]),
        )
    )
    return out


def fan_svg(paid: np.ndarray) -> str:
    w, h, ml, mb, mt = 760, 420, 60, 50, 24
    x = lambda t: ml + (w - ml - 20) * t / MONTHS
    lo, md, hi = (np.percentile(paid, k, axis=1) for k in (10, 50, 90))
    ymax = float(np.ceil(hi.max() / 100) * 100) or 100.0
    y = lambda v: mt + (h - mt - mb) * (1 - v / ymax)
    band = " ".join(f"{x(t):.1f},{y(hi[t]):.1f}" for t in range(MONTHS + 1))
    band += " " + " ".join(f"{x(t):.1f},{y(lo[t]):.1f}" for t in range(MONTHS, -1, -1))
    line = " ".join(f"{x(t):.1f},{y(md[t]):.1f}" for t in range(MONTHS + 1))
    grid = "".join(
        f'<line x1="{ml}" x2="{w-20}" y1="{y(v):.1f}" y2="{y(v):.1f}" stroke="#d0d7de"/>'
        f'<text x="{ml-8}" y="{y(v)+4:.1f}" text-anchor="end" font-size="11" fill="#57606a">{int(v)}</text>'
        for v in np.linspace(0, ymax, 5)
    )
    ticks = "".join(
        f'<text x="{x(t):.1f}" y="{h-mb+18}" text-anchor="middle" font-size="11" fill="#57606a">{t}</text>'
        for t in range(0, MONTHS + 1, 6)
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" font-family="sans-serif">'
        f'<rect width="{w}" height="{h}" fill="#ffffff"/>{grid}{ticks}'
        f'<polygon points="{band}" fill="#0969da" fill-opacity="0.18"/>'
        f'<polyline points="{line}" fill="none" stroke="#0969da" stroke-width="2.5"/>'
        f'<text x="{ml}" y="14" font-size="13" font-weight="bold" fill="#1f2328">'
        "Paying customers, median and 10-90% band (5,000 runs)</text>"
        f'<text x="{(w+ml)/2:.0f}" y="{h-8}" text-anchor="middle" font-size="12" fill="#57606a">'
        "Months after launch</text></svg>"
    )


def main() -> None:
    rng = np.random.default_rng(SEED)
    awards, winners = load()
    inp = market_inputs(awards, winners, rng)
    res = run_model(inp, rng)
    summary = summarize(res)

    OUT.mkdir(parents=True, exist_ok=True)
    public = {k: v for k, v in inp.items() if not k.startswith("_")}
    (OUT / "adoption_inputs.json").write_text(json.dumps(public, indent=2), encoding="utf-8")
    (OUT / "adoption_results.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (OUT / "adoption_fan.svg").write_text(fan_svg(res["paid"]), encoding="utf-8")
    print(json.dumps({"inputs": public, "results": summary}, indent=2))


if __name__ == "__main__":
    sys.exit(main())
