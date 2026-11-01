"""Sanity checks for the adoption model, on synthetic SEAP-shaped data."""

import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import adoption_model as am


def _inputs():
    rng = np.random.default_rng(1)
    start = date(2025, 11, 1)
    awards = [
        {"id": str(i), "date": (start + timedelta(days=i % 360)).isoformat(),
         "value": float(rng.lognormal(16, 1.2)), "authority": "x"}
        for i in range(2000)
    ]
    winners = [{"id": str(i), "cif": str(rng.integers(0, 600)), "name": "w", "offers": int(rng.integers(1, 6))}
               for i in range(400)]
    return am.market_inputs(awards, winners, rng)


def test_paid_customers_never_negative_and_bands_ordered():
    res = am.run_model(_inputs(), np.random.default_rng(2))
    assert (res["paid"] >= 0).all()
    for month in (6, 12, 24, 36):
        p10, p50, p90 = (np.percentile(res["paid"][month], k) for k in (10, 50, 90))
        assert p10 <= p50 <= p90


def test_customers_cannot_exceed_the_market():
    res = am.run_model(_inputs(), np.random.default_rng(3))
    assert (res["paid"][-1] <= res["market"] + 1e-6).all()


def test_same_seed_gives_same_result():
    a = am.run_model(_inputs(), np.random.default_rng(4))["paid"]
    b = am.run_model(_inputs(), np.random.default_rng(4))["paid"]
    assert np.array_equal(a, b)


def test_revenue_follows_customers():
    res = am.run_model(_inputs(), np.random.default_rng(5))
    low, high = am.PRICES.min(), am.PRICES.max()
    ratio = res["mrr"][12] / np.maximum(res["paid"][12], 1e-9)
    assert ((ratio >= low - 1e-6) & (ratio <= high + 1e-6) | (res["paid"][12] < 1e-6)).all()
