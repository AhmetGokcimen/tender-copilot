"""VAT (TVA) rates in force in Romania, by date.

There is no official machine-readable feed for the VAT rate, so the rates are
kept here as a dated table: when the law changes, add one line (effective
date, rate) and every document and screen follows. Nothing else in the code
holds a VAT number.
"""

from datetime import UTC, date, datetime

# (effective from, standard rate). Oldest first.
VAT_STANDARD: list[tuple[date, float]] = [
    (date(2017, 1, 1), 0.19),  # Codul fiscal, standard rate
    (date(2025, 8, 1), 0.21),  # Legea nr. 141/2025, standard rate raised to 21%
]

SOURCE_NOTE = "Codul fiscal (cota standard de TVA). Update backend/core/tax.py when the law changes."


def vat_rate_on(day: date | None = None) -> tuple[float, date]:
    """(rate, effective-from date) of the standard VAT rate on `day` (today by default)."""
    day = day or datetime.now(UTC).date()
    chosen = VAT_STANDARD[0]
    for entry in VAT_STANDARD:
        if entry[0] <= day:
            chosen = entry
    return chosen[1], chosen[0]
