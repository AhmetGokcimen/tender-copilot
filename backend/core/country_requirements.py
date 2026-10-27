"""Static per-country bidding-requirements reference.

Only Romania carries a real write-up today; Poland/Bulgaria (planned
adapter extensions) and anything else get an honest placeholder. This is
general information, never legal advice — the copy says so explicitly,
and nothing here is verified against any registry.
"""

GUIDES: dict[str, str] = {
    "RO": (
        "Companies bidding in Romania typically need to be registered with "
        "the Trade Registry (ONRC) or act through a locally registered "
        "branch, subsidiary, or authorized representative; some procedures "
        "additionally require ANAF fiscal registration. Exact requirements "
        "vary by procedure — confirm with the contracting authority or a "
        "local advisor. General information only, not legal advice."
    ),
}

NAMES: dict[str, str] = {"RO": "Romania", "PL": "Poland", "BG": "Bulgaria"}


def get_country_requirements(country_code: str) -> dict:
    code = (country_code or "").strip().upper()
    if code in GUIDES:
        return {
            "country_code": code,
            "name": NAMES.get(code),
            "guide_available": True,
            "guidance": GUIDES[code],
        }
    name = NAMES.get(code)
    return {
        "country_code": code,
        "name": name,
        "guide_available": False,
        "guidance": (
            f"Country-specific guidance for {name or code} is coming soon. "
            "Confirm requirements with the contracting authority or a local "
            "advisor. General information only, not legal advice."
        ),
    }
