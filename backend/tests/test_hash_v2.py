"""Structuur-tests v0.23.0-Diffie — borgen dat de nieuwe pHash-functies
en compareHashesElastic in frontend/js/hash.js aanwezig zijn én geëxporteerd
worden via window.PDFHorseHash. Geen DOM nodig — pure regex op de bronfile.
Dit voorkomt stille regressie bij refactors.
"""
from __future__ import annotations

import re
from pathlib import Path

HASH_JS = Path(__file__).resolve().parents[2] / "frontend" / "js" / "hash.js"


def _src() -> str:
    return HASH_JS.read_text(encoding="utf-8")


def test_hash_js_exists():
    assert HASH_JS.is_file(), f"missing {HASH_JS}"


def test_phash_dct_function_defined():
    src = _src()
    assert re.search(r"\bfunction\s+pagePerceptualHashesDct\s*\(", src), \
        "pagePerceptualHashesDct() ontbreekt"
    assert re.search(r"_dctHash\s*\(", src), "_dctHash helper ontbreekt"


def test_phash_dhash_function_defined():
    src = _src()
    assert re.search(r"\bfunction\s+pagePerceptualHashesDhash\s*\(", src), \
        "pagePerceptualHashesDhash() ontbreekt"
    assert re.search(r"_dhash\s*\(", src), "_dhash helper ontbreekt"


def test_compare_hashes_elastic_defined():
    src = _src()
    assert re.search(r"\bfunction\s+compareHashesElastic\s*\(", src), \
        "compareHashesElastic() ontbreekt"
    # Moet het 5x5 shift-bereik gebruiken (-maxShift..+maxShift).
    assert re.search(r"maxShift", src), "maxShift parameter ontbreekt"


def test_legacy_avg_phash_still_present():
    """Backwards compat: 8x8 avg-hash blijft beschikbaar voor poa-v1 PDFs."""
    src = _src()
    assert re.search(r"\bfunction\s+pagePerceptualHashes\s*\(", src), \
        "pagePerceptualHashes() (avg) ontbreekt — breakt poa-v1 verify"
    assert re.search(r"_avgHash8x8", src), "_avgHash8x8 helper ontbreekt"


def test_window_exports_new_api():
    src = _src()
    # Allow optional whitespace around colons.
    for name in [
        "pagePerceptualHashesDct",
        "pagePerceptualHashesDhash",
        "compareHashesElastic",
    ]:
        assert re.search(rf"\b{name}\s*:\s*{name}\b", src), \
            f"window.PDFHorseHash mist '{name}'"


def test_engine_version_bumped():
    src = _src()
    m = re.search(r"VERSION\s*:\s*'([^']+)'", src)
    assert m, "VERSION-veld ontbreekt"
    # v0.23 hash-engine = 0.2.0 (was 0.1.0 in v0.22).
    assert m.group(1) == "0.2.0", f"Verwacht engine VERSION='0.2.0', kreeg '{m.group(1)}'"
