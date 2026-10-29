"""Onboarding lookups: industries, keywords, countries, validation."""

import pytest


def test_industries_carry_cpv_suggestions() -> None:
    from backend.core.lookups import INDUSTRIES

    assert INDUSTRIES["construction"].suggested_cpv_codes == ["45000000"]
    assert "software" in INDUSTRIES
    for key, industry in INDUSTRIES.items():
        assert key and industry.label and industry.suggested_cpv_codes


def test_keywords_and_countries_are_known_sets() -> None:
    from backend.core.lookups import COUNTRIES, KEYWORDS

    assert "it-equipment" in KEYWORDS
    assert [c.code for c in COUNTRIES] == ["RO"]
    assert COUNTRIES[0].source_systems == ["romania_seap"]


def test_validate_company_data_accepts_good_input() -> None:
    from backend.core.lookups import validate_company_data

    validate_company_data(
        {
            "industry": "software",
            "keywords": ["software-licenses"],
            "target_countries": ["RO"],
            "founded_year": 2010,
            "team_size": 25,
            "annual_turnover": 1000000.0,
        }
    )
    validate_company_data({})  # partial wizard steps validate too


def test_validate_company_data_rejects_unknown_values() -> None:
    from backend.core.lookups import validate_company_data

    with pytest.raises(ValueError, match="industry"):
        validate_company_data({"industry": "alchemy"})
    with pytest.raises(ValueError, match="keyword"):
        validate_company_data({"keywords": ["teleportation"]})
    with pytest.raises(ValueError, match="country"):
        validate_company_data({"target_countries": ["XX"]})
    with pytest.raises(ValueError, match="founded_year"):
        validate_company_data({"founded_year": 1492})
    with pytest.raises(ValueError, match="team_size"):
        validate_company_data({"team_size": -3})


def test_apply_industry_preseed_seeds_empty_cpv_only() -> None:
    from backend.core.lookups import apply_industry_preseed
    from backend.models.company import CompanyProfile

    fresh = CompanyProfile(name="X", industry="software")
    apply_industry_preseed(fresh)
    assert fresh.cpv_codes == ["48000000", "72200000"]

    explicit = CompanyProfile(name="Y", industry="software", cpv_codes=["12345678"])
    apply_industry_preseed(explicit)
    assert explicit.cpv_codes == ["12345678"]

    no_industry = CompanyProfile(name="Z")
    apply_industry_preseed(no_industry)
    assert no_industry.cpv_codes == []


def test_profile_completeness_tracks_minimum_viable_profile() -> None:
    from backend.core.lookups import (
        OPTIONAL_PROFILE_FIELDS,
        REQUIRED_PROFILE_FIELDS,
        profile_completeness,
    )
    from backend.models.company import CompanyProfile

    assert REQUIRED_PROFILE_FIELDS == ["name", "industry", "annual_turnover"]
    assert "keywords" in OPTIONAL_PROFILE_FIELDS

    bare = CompanyProfile(name="Co")
    status = profile_completeness(bare)
    assert status["complete"] is False
    assert status["missing_required"] == ["industry", "annual_turnover"]

    bare.industry = "software"
    bare.annual_turnover = 500000.0
    bare.keywords = []
    status = profile_completeness(bare)
    assert status["complete"] is True
    assert "keywords" in status["missing_optional"]  # empty list still counts as missing
