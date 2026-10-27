"""OCR pipeline tests: page classification, p7s unwrap, text merge, vision call shape.

All offline: PDFs are built in-memory with PyMuPDF/Pillow, CMS blobs with
asn1crypto, and the Meta API is faked with httpx.MockTransport.
"""

import io
import json

import httpx
import pymupdf
import pytest
from asn1crypto import cms, pem
from PIL import Image, ImageDraw


def _png_with_text(text: str) -> bytes:
    img = Image.new("RGB", (800, 200), "white")
    ImageDraw.Draw(img).text((20, 80), text, fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _mixed_pdf() -> bytes:
    """3 pages: text-layered, image-only (scanned), empty."""
    doc = pymupdf.open()
    text_page = doc.new_page()
    text_page.insert_text((72, 72), "Eligibility: turnover minim 1 000 000 lei. " * 6)
    scanned_page = doc.new_page()
    scanned_page.insert_image(scanned_page.rect, stream=_png_with_text("caiet de sarcini"))
    doc.new_page()  # empty
    pdf = doc.tobytes()
    doc.close()
    return pdf


def _scanned_pdf(n: int) -> bytes:
    doc = pymupdf.open()
    png = _png_with_text("pagina scanata")
    for _ in range(n):
        page = doc.new_page()
        page.insert_image(page.rect, stream=png)
    pdf = doc.tobytes()
    doc.close()
    return pdf


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


def test_classify_pages_marks_text_scanned_empty() -> None:
    from ai.ocr import classify_pages

    assert classify_pages(_mixed_pdf()) == ["text", "scanned", "empty"]


def test_unwrap_p7s_returns_inner_pdf() -> None:
    from ai.ocr import unwrap_p7s

    inner = b"%PDF-1.5 fake-caiet-bytes"
    assert unwrap_p7s(_cms_blob(inner)) == inner


def test_unwrap_p7s_accepts_pem_armor_and_plain_pdf() -> None:
    from ai.ocr import unwrap_p7s

    inner = b"%PDF-1.4 fake"
    assert unwrap_p7s(pem.armor("PKCS7", _cms_blob(inner))) == inner
    assert unwrap_p7s(inner) == inner


def test_unwrap_p7s_rejects_garbage() -> None:
    from ai.ocr import OCRError, unwrap_p7s

    with pytest.raises(OCRError):
        unwrap_p7s(b"definitely not cms or pdf")


@pytest.mark.asyncio
async def test_extract_pdf_text_merges_text_and_ocr_in_order() -> None:
    from ai.ocr import extract_pdf_text

    async def fake_ocr(png: bytes) -> str:
        assert png[:8] == b"\x89PNG\r\n\x1a\n"
        return "OCR-TRANSCRIPTION"

    result = await extract_pdf_text(_mixed_pdf(), ocr_page=fake_ocr)
    assert result.page_kinds == ["text", "scanned", "empty"]
    assert result.scanned_pages == [2]
    assert result.ocr_pages == 1
    assert result.ocr_errors == {}
    assert not result.truncated
    assert "turnover" in result.page_texts[0]
    assert result.page_texts[1] == "OCR-TRANSCRIPTION"
    assert result.page_texts[2] == ""
    assert result.full_text.index("turnover") < result.full_text.index("OCR-TRANSCRIPTION")


@pytest.mark.asyncio
async def test_extract_pdf_text_marks_ocr_failures_and_continues() -> None:
    from ai.ocr import extract_pdf_text

    async def boom(png: bytes) -> str:
        raise RuntimeError("vision down")

    result = await extract_pdf_text(_scanned_pdf(2), ocr_page=boom)
    assert result.ocr_pages == 0
    assert set(result.ocr_errors) == {1, 2}
    assert "OCR failed" in result.full_text


@pytest.mark.asyncio
async def test_extract_pdf_text_respects_max_ocr_pages() -> None:
    from ai.ocr import extract_pdf_text

    calls = 0

    async def counting_ocr(png: bytes) -> str:
        nonlocal calls
        calls += 1
        return "T"

    result = await extract_pdf_text(_scanned_pdf(3), ocr_page=counting_ocr, max_ocr_pages=2)
    assert calls == 2
    assert result.truncated
    assert "page cap" in result.full_text


@pytest.mark.asyncio
async def test_ocr_image_sends_input_image_and_reads_output_text() -> None:
    from ai.client import MetaAIClient

    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "output": [
                    {
                        "type": "message",
                        "content": [{"type": "output_text", "text": "TRANSCRIBED"}],
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    client = MetaAIClient(
        httpx.AsyncClient(transport=transport, base_url="https://api.meta.ai/v1")
    )
    assert await client.ocr_image(_png_with_text("x")) == "TRANSCRIBED"

    parts = seen["input"][0]["content"]
    images = [p for p in parts if p["type"] == "input_image"]
    assert len(images) == 1
    assert images[0]["image_url"].startswith("data:image/png;base64,")
