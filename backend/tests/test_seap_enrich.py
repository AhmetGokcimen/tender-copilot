"""SEAP display-field enrichment: procedure mapping, county, clarification."""

import httpx
import pytest

LIST_ITEM = {
    "cNoticeId": 100246422,
    "noticeNo": "SCN1181378",
    "sysNoticeTypeId": 17,
    "sysNoticeVersionId": 2,
    "contractTitle": "MODERNIZARE STRAZI",
    "contractingAuthorityNameAndFN": "3519607 - Comuna Vinga",
    "cpvCodeAndName": "45233120-6 - Lucrari de constructii de drumuri (Rev.2)",
    "estimatedValueRon": 25790564.0,
    "noticeStateDate": "2026-10-25T19:47:43+02:00",
    "maxTenderReceiptDeadline": "2026-11-18T15:00:00+02:00",
    "sysProcedureType": {"id": 20, "text": "Procedura simplificata"},
    "sysContractAssigmentType": {"id": 1, "text": "Contract de achizitii publice"},
}

SECTION1 = {
    "noticeEntityAddress": {
        "officialName": "Comuna Vinga",
        "city": "Vinga",
        "county": None,
        "nutsCode": {"id": 52, "text": "RO421 Arad"},
    },
    "noDays": 14,
}


def test_map_procedure_type_covers_seap_vocab() -> None:
    from backend.adapters.romania_seap.adapter import map_procedure_type

    def proc(text: str) -> dict:
        return {"id": 0, "text": text}

    def assign(text: str) -> dict:
        return {"id": 0, "text": text}
    assert map_procedure_type(proc("Licitatie deschisa"), assign("Contract")) == "open"
    assert map_procedure_type(proc("Licitatie restransa"), assign("Contract")) == "restricted"
    assert map_procedure_type(proc("Procedura simplificata"), assign("Contract")) == "open"
    assert map_procedure_type(proc("Licitatie deschisa"), assign("Acord-cadru")) == "framework"
    assert map_procedure_type(proc("Negociere competitiva"), assign("Contract")) == "negotiated"
    assert map_procedure_type(proc("Cumparare directa"), assign("Contract")) == "direct"
    assert map_procedure_type(None, None) == "open"  # documented default, see API_CHANGES.md


def test_map_notice_sets_procedure_type() -> None:
    from backend.adapters.romania_seap.adapter import RomaniaSeapAdapter

    tender = RomaniaSeapAdapter()._map_notice(LIST_ITEM)
    assert tender.procedure_type == "open"


@pytest.mark.asyncio
async def test_fetch_tenders_enriches_county_and_clarification() -> None:
    from backend.adapters.romania_seap.adapter import RomaniaSeapAdapter

    def handler(request: httpx.Request) -> httpx.Response:
        if "GetCNoticeList" in str(request.url):
            return httpx.Response(200, json={"items": [LIST_ITEM], "total": 1})
        if "GetSection1View" in str(request.url):
            return httpx.Response(200, json=SECTION1)
        raise AssertionError(f"unexpected {request.url}")

    adapter = RomaniaSeapAdapter(
        httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="https://e-licitatie.ro"
        )
    )
    (tender,) = await adapter.fetch_tenders(cpv_codes=["45233120"], days=7)
    assert tender.county == "Arad"
    assert tender.clarification_deadline is not None
    assert (tender.submission_deadline - tender.clarification_deadline).days == 14


@pytest.mark.asyncio
async def test_fetch_tenders_survives_section1_failure() -> None:
    from backend.adapters.romania_seap.adapter import RomaniaSeapAdapter

    def handler(request: httpx.Request) -> httpx.Response:
        if "GetCNoticeList" in str(request.url):
            return httpx.Response(200, json={"items": [LIST_ITEM], "total": 1})
        return httpx.Response(500, json={})

    adapter = RomaniaSeapAdapter(
        httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="https://e-licitatie.ro"
        )
    )
    (tender,) = await adapter.fetch_tenders(cpv_codes=["45233120"], days=7)
    assert tender.county is None
    assert tender.clarification_deadline is None
    assert tender.procedure_type == "open"  # list-level field still mapped
