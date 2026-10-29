"""Award print-PDF text parsing (deterministic, no AI)."""

from backend.adapters.romania_seap.adapter import _parse_ro_number, parse_award_text

# Shape mirrors the verified CAN1065826 print (2026-10-28), trimmed to the
# parsed sections plus realistic header/footer boilerplate.
SAMPLE = """Furnizare gaze naturale


Sectiunea I: AUTORITATEA CONTRACTANTA
I.1) Denumire si adrese
Spitalul Orasenesc Sinaia
V.2.1) Numarul si data incheierii contractului
Sistemul Electronic de Achizitii Publice
Anunt publicat: [CAN1065826/04.11.2021]
Pagina 2
Generat la: 28.10.2026 13:03
263 / 28.10.2021

V.2.2) Informatii privind ofertele
Numarul de oferte primite: 1
Numarul de oferte primite de la IMM-uri: 1
Numarul de oferte primite de la ofertanti din alte state membre ale UE: 0
Contractul a fost atribuit unui grup de operatori economici: Nu

V.2.3) Numele si adresa contractantului
PREMIER ENERGY TRADING
Cod de identificare fiscala: RO7127592; Adresa: Strada Alecsandri Vasile, Nr. 4;
Localitatea: Bucuresti; Cod NUTS: RO321 Bucuresti; Tara: Romania;

V.2.4) Informatii privind valoarea contractului/lotului
Valoarea totala estimata initiala a contractului/lotului: 891423
Valoarea totala a contractului/lotului: 838435
Moneda: RON

V.2.5) Informatii privind subcontractarea
Este probabil sa se recurga la subcontractarea contractului: Nu
"""


def test_parse_award_text_full() -> None:
    detail = parse_award_text(SAMPLE)
    assert detail.winner_name == "PREMIER ENERGY TRADING"
    assert detail.winner_cif == "RO7127592"
    assert "PREMIER ENERGY TRADING" in (detail.winner_raw or "")
    assert detail.offers_received == 1
    assert detail.offers_from_sme == 1
    assert detail.contract_no == "263"
    assert detail.contract_date is not None
    assert (detail.contract_date.year, detail.contract_date.month, detail.contract_date.day) == (
        2021, 10, 28)
    assert detail.estimated_initial_value == 891423.0
    assert detail.publication_date is not None
    assert (detail.publication_date.year, detail.publication_date.month) == (2021, 11)


def test_parse_award_text_missing_blocks() -> None:
    detail = parse_award_text("not an award document at all")
    assert detail.winner_name is None
    assert detail.winner_cif is None
    assert detail.offers_received is None
    assert detail.contract_no is None

    # Cancelled-style award: section V present but no V.2 detail blocks.
    detail = parse_award_text("Sectiunea V: Atribuirea contractului\nSe atribuie un contract: Nu\n")
    assert detail.winner_name is None
    assert detail.publication_date is None


def test_parse_ro_number_formats() -> None:
    assert _parse_ro_number("891423") == 891423.0
    assert _parse_ro_number("1 234,50") == 1234.5
    assert _parse_ro_number("garbage") is None
    assert _parse_ro_number(None) is None
    assert _parse_ro_number("") is None
