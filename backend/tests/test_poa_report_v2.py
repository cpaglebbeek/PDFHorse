"""Structuur-tests v0.24.0-Rivest — borgen dat het uitgebreide PoA-rapport
(claim-v2 + match-rapport) in `frontend/js/poa-report.js` aanwezig is.

Geen DOM nodig — pure regex op de bronfile. Voorkomt stille regressie
bij refactors die de twee nieuwe rapport-types of de kleur-mapping per
verdict zouden breken.
"""
from __future__ import annotations

import re
from pathlib import Path

POA_JS = Path(__file__).resolve().parents[2] / "frontend" / "js" / "poa-report.js"


def _src() -> str:
    return POA_JS.read_text(encoding="utf-8")


def test_poa_js_exists() -> None:
    assert POA_JS.is_file(), f"missing {POA_JS}"


def test_legacy_build_still_present() -> None:
    """Backwards-compat: legacy 1-pagina build() blijft beschikbaar voor poa-v1."""
    src = _src()
    assert re.search(r"\bfunction\s+build\s*\(\s*meta\s*\)", src), \
        "legacy build(meta) ontbreekt"


def test_build_claim_v2_defined() -> None:
    src = _src()
    assert re.search(r"\bfunction\s+buildClaimV2\s*\(\s*meta\s*\)", src), \
        "buildClaimV2(meta) ontbreekt"
    # Moet expliciet twee paginas aanmaken (newPage call).
    assert re.search(r"newPage\s*\(\s*\)", src), \
        "buildClaimV2 mist newPage() call voor 2-pagina layout"


def test_build_match_report_defined() -> None:
    src = _src()
    assert re.search(
        r"\bfunction\s+buildMatchReport\s*\(\s*meta\s*,\s*verifyResult\s*,\s*currentFileInfo\s*\)",
        src,
    ), "buildMatchReport(meta, verifyResult, currentFileInfo) ontbreekt"


def test_verdict_box_helper_defined() -> None:
    src = _src()
    assert re.search(r"\bverdictBox\s*\(", src), \
        "_drawVerdictBox helper (renderer.verdictBox) ontbreekt"


def test_verdict_color_mapping_present() -> None:
    """IDENTICAL→groen, LAYOUT_MATCH→groen, PROBABLE→oranje, NO_MATCH→rood."""
    src = _src()
    # Vind het kleur-blok per verdict.
    block = re.search(r"var\s+map\s*=\s*\{([^}]+IDENTICAL[^;]+NO_MATCH[^}]+)\}", src)
    assert block is not None, "verdict-color-map niet gevonden"
    body = block.group(1)
    # IDENTICAL & LAYOUT_MATCH moeten groen-tinten zijn: G > R en G > B
    for name, expect in [
        ("IDENTICAL", "green"),
        ("LAYOUT_MATCH", "green"),
        ("PROBABLE", "orange"),
        ("NO_MATCH", "red"),
    ]:
        m = re.search(
            rf"{name}\s*:\s*\{{\s*fill\s*:\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)",
            body,
        )
        assert m, f"{name} kleur-fill ontbreekt in verdict-map"
        rch, gch, bch = float(m.group(1)), float(m.group(2)), float(m.group(3))
        if expect == "green":
            assert gch >= rch and gch >= bch, \
                f"{name} verwacht groen-dominant fill, kreeg rgb=({rch},{gch},{bch})"
        elif expect == "red":
            assert rch > gch and rch > bch, \
                f"{name} verwacht rood-dominant fill, kreeg rgb=({rch},{gch},{bch})"
        elif expect == "orange":
            # oranje = hoge R + hoge G, lagere B
            assert rch >= 0.9 and gch >= 0.5 and bch < gch, \
                f"{name} verwacht oranje-fill (hoog R+G, lager B), kreeg rgb=({rch},{gch},{bch})"


def test_window_exports_new_api() -> None:
    src = _src()
    for name in ("build", "buildClaimV2", "buildMatchReport"):
        assert re.search(rf"\b{name}\s*:\s*{name}\b", src), \
            f"window.PDFHorsePoaReport mist '{name}'"


def test_match_report_uses_verify_result_score() -> None:
    """Match-rapport moet expliciet verifyResult.score gebruiken voor het verdict-%."""
    src = _src()
    # Eis dat ergens in buildMatchReport een Math.round(score * 1000) / 10 patroon staat.
    m = re.search(
        r"function\s+buildMatchReport\b.+?return\s+await\s+doc\.save",
        src,
        re.DOTALL,
    )
    assert m, "kon buildMatchReport-body niet vinden"
    body = m.group(0)
    assert re.search(r"verifyResult\s*\.\s*score", body), \
        "buildMatchReport gebruikt verifyResult.score niet"
    assert re.search(r"Math\.round\s*\(\s*score\s*\*\s*1000\s*\)\s*/\s*10", body), \
        "buildMatchReport rondt score niet af op 1 decimaal voor display"


def test_app_uses_build_claim_v2() -> None:
    """app.js#runHash() moet Poa.buildClaimV2 aanroepen voor poa-v2 envelopes."""
    app_js = POA_JS.parent / "app.js"
    assert app_js.is_file(), f"missing {app_js}"
    src = app_js.read_text(encoding="utf-8")
    assert re.search(r"Poa\.buildClaimV2\s*\(", src), \
        "app.js roept Poa.buildClaimV2 niet aan"
    assert re.search(r"Poa\.buildMatchReport\s*\(", src), \
        "app.js roept Poa.buildMatchReport niet aan"
    assert re.search(r"matchReportBytes", src), \
        "app.js zet hashing.matchReportBytes niet"
    assert re.search(r"downloadMatchReport\s*\(\s*\)", src), \
        "app.js mist downloadMatchReport() handler"


def test_poa_report_version_bumped() -> None:
    src = _src()
    m = re.search(r"VERSION\s*:\s*'([^']+)'", src)
    assert m, "VERSION-veld ontbreekt"
    # v0.22 had 0.1.0; v0.24 → 0.2.0; v0.25 (Shamir, identity-binding) → 0.3.0.
    assert m.group(1) == "0.3.0", f"Verwacht poa-report VERSION='0.3.0', kreeg '{m.group(1)}'"
