"""SEAP notice-file download tests (all offline via httpx.MockTransport)."""

import httpx
import pytest
from asn1crypto import cms


def _cms_blob(inner: bytes) -> bytes:
    return cms.ContentInfo(
        {
            "content_type": "signed_data",
            "content": {
                "version": 1,
                "digest_algorithms": [{"algorithm": "sha256"}],
                "encap_content_info": {"content_type": "data", "content": inner},
                "signer_infos": [],
            },
        }
    ).dump()


def _adapter(handler) -> object:
    from backend.adapters.romania_seap.adapter import RomaniaSeapAdapter

    client = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://e-licitatie.ro"
    )
    return RomaniaSeapAdapter(client=client)


@pytest.mark.asyncio
async def test_fetch_notice_documents_parses_df_notice_docs() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "GetDfNoticeSectionFiles" in str(request.url)
        return httpx.Response(
            200,
            json={
                "dfNoticeDocs": [
                    {
                        "noticeDocumentName": "Caiet de sarcini.pdf",
                        "noticeDocumentUrl": "api-pub/files/noticedoc/aaa",
                    },
                    {
                        "noticeDocumentName": "Contract.docx",
                        "noticeDocumentUrl": "api-pub/files/noticedoc/bbb",
                    },
                ]
            },
        )

    docs = await _adapter(handler).fetch_notice_documents("100", 17)
    assert [(d.name, d.url) for d in docs] == [
        ("Caiet de sarcini.pdf", "api-pub/files/noticedoc/aaa"),
        ("Contract.docx", "api-pub/files/noticedoc/bbb"),
    ]


@pytest.mark.asyncio
async def test_fetch_caiet_pdf_prefers_plain_pdf_over_p7s() -> None:
    requested: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if "GetDfNoticeSectionFiles" in str(request.url):
            return httpx.Response(
                200,
                json={
                    "dfNoticeDocs": [
                        {
                            "noticeDocumentName": "Caiet de sarcini.pdf.p7s",
                            "noticeDocumentUrl": "api-pub/files/noticedoc/signed",
                        },
                        {
                            "noticeDocumentName": "Caiet de sarcini.pdf",
                            "noticeDocumentUrl": "api-pub/files/noticedoc/plain",
                        },
                    ]
                },
            )
        requested.append(str(request.url))
        return httpx.Response(200, content=b"%PDF-1.4 plain-caiet")

    caiet = await _adapter(handler).fetch_caiet_pdf("100", 17)
    assert caiet is not None
    assert caiet.pdf_bytes == b"%PDF-1.4 plain-caiet"
    assert requested == ["https://e-licitatie.ro/api-pub/files/noticedoc/plain"]


@pytest.mark.asyncio
async def test_fetch_caiet_pdf_unwraps_p7s_signature() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if "GetDfNoticeSectionFiles" in str(request.url):
            return httpx.Response(
                200,
                json={
                    "dfNoticeDocs": [
                        {
                            "noticeDocumentName": "Caiet de sarcini.pdf.p7s",
                            "noticeDocumentUrl": "api-pub/files/noticedoc/signed",
                        }
                    ]
                },
            )
        return httpx.Response(200, content=_cms_blob(b"%PDF-1.5 inner-caiet"))

    caiet = await _adapter(handler).fetch_caiet_pdf("100", 17)
    assert caiet is not None
    assert caiet.pdf_bytes == b"%PDF-1.5 inner-caiet"


@pytest.mark.asyncio
async def test_fetch_caiet_pdf_returns_none_when_missing() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"dfNoticeDocs": []})

    assert await _adapter(handler).fetch_caiet_pdf("100", 17) is None
