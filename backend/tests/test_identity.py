"""Structuur-tests v0.25.0-Shamir — borgen dat OpenPGP identity-binding correct
in frontend/js/identity.js + index.html (SRI) + i18n.json + app.js gewired is.

Geen run-time test (OpenPGP.js is een 550 kB browser-bibliotheek, niet door pytest
te draaien). Pure regex-checks op de bronfiles, voorkomen stille regressie.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IDENTITY_JS = ROOT / "frontend" / "js" / "identity.js"
APP_JS = ROOT / "frontend" / "js" / "app.js"
POA_JS = ROOT / "frontend" / "js" / "poa-report.js"
INDEX_HTML = ROOT / "frontend" / "index.html"
I18N_JSON = ROOT / "frontend" / "i18n.json"


# ---------- identity.js ------------------------------------------------------


def test_identity_js_exists() -> None:
    assert IDENTITY_JS.is_file(), f"missing {IDENTITY_JS}"


def test_identity_js_exposes_window_namespace() -> None:
    src = IDENTITY_JS.read_text(encoding="utf-8")
    assert re.search(r"window\.PDFHorseIdentity\s*=\s*\{", src), \
        "identity.js exposeert window.PDFHorseIdentity niet"


def test_identity_js_has_required_methods() -> None:
    src = IDENTITY_JS.read_text(encoding="utf-8")
    for name in (
        "generateKey",
        "importKey",
        "canonicalize",
        "signEnvelope",
        "verifyEnvelope",
    ):
        assert re.search(rf"\b(async\s+)?function\s+{name}\s*\(", src), \
            f"identity.js mist {name}()"
        assert re.search(rf"\b{name}\s*:\s*{name}\b", src), \
            f"window.PDFHorseIdentity mist '{name}'"


def test_identity_js_uses_ed25519() -> None:
    """Curve25519 / Ed25519 i.p.v. RSA — sneller + kleinere keys."""
    src = IDENTITY_JS.read_text(encoding="utf-8")
    assert re.search(r"curve\s*:\s*['\"]ed25519['\"]", src), \
        "generateKey moet curve='ed25519' gebruiken"


def test_identity_js_canonicalize_strips_signature() -> None:
    """canonicalize() MOET het signature-veld uitsluiten zodat verify reproduceerbaar is."""
    src = IDENTITY_JS.read_text(encoding="utf-8")
    # Eis: in de body van canonicalize wordt 'signature' expliciet weggefilterd.
    m = re.search(r"function\s+canonicalize\b.+?\n  \}\n", src, re.DOTALL)
    assert m, "canonicalize-body niet gevonden"
    body = m.group(0)
    assert re.search(r"['\"]signature['\"]", body), \
        "canonicalize moet 'signature' string ergens noemen (strippen)"
    assert re.search(r"sort\s*\(", body), \
        "canonicalize moet keys sorteren (deterministisch)"
    assert "TextEncoder" in body, \
        "canonicalize moet UTF-8 bytes returnen via TextEncoder"


def test_identity_js_passphrase_minimum() -> None:
    """Passphrase minimaal 8 tekens — anders generateKey throwt."""
    src = IDENTITY_JS.read_text(encoding="utf-8")
    assert re.search(r"passphrase[\s\S]{0,200}length\s*<\s*8", src), \
        "generateKey moet passphrase < 8 chars weigeren"


def test_identity_js_no_localstorage() -> None:
    """Security: GEEN private key / passphrase naar localStorage of sessionStorage.

    Comment-vermeldingen ("nooit naar localStorage") zijn toegestaan en zelfs
    gewenst — alleen daadwerkelijk *gebruik* (`localStorage.setItem`, lookup,
    of `localStorage[` indexing) is verboden.
    """
    src = IDENTITY_JS.read_text(encoding="utf-8")
    # Strip JS-comments uit de bron zodat we alleen ECHTE referenties testen.
    no_block = re.sub(r"/\*[\s\S]*?\*/", "", src)
    no_line = re.sub(r"//[^\n]*", "", no_block)
    assert "localStorage" not in no_line, "identity.js mag localStorage NIET aanroepen"
    assert "sessionStorage" not in no_line, "identity.js mag sessionStorage NIET aanroepen"


# ---------- index.html SRI + script tag --------------------------------------


def test_index_html_loads_openpgp_with_sri() -> None:
    src = INDEX_HTML.read_text(encoding="utf-8")
    # Exacte pin op 5.11.2.
    assert "openpgp@5.11.2/dist/openpgp.min.js" in src, \
        "index.html mist openpgp@5.11.2 CDN-script"
    # SHA-384 SRI aanwezig.
    m = re.search(
        r"openpgp@5\.11\.2[\s\S]{0,200}integrity\s*=\s*['\"]sha384-([A-Za-z0-9+/=]+)['\"]",
        src,
    )
    assert m, "openpgp script-tag mist SRI sha384-..."
    assert len(m.group(1)) >= 60, "SRI hash lijkt te kort"
    # crossorigin verplicht voor SRI op cross-origin scripts.
    assert re.search(
        r"openpgp@5\.11\.2[\s\S]{0,400}crossorigin\s*=\s*['\"]anonymous['\"]",
        src,
    ), "openpgp script-tag mist crossorigin=anonymous"


def test_index_html_loads_identity_js() -> None:
    src = INDEX_HTML.read_text(encoding="utf-8")
    assert re.search(r"<script\s+src=['\"]js/identity\.js['\"]\s*>", src), \
        "index.html laadt js/identity.js niet"


def test_index_html_has_identity_accordion() -> None:
    src = INDEX_HTML.read_text(encoding="utf-8")
    assert "Identity binding" in src, \
        "index.html mist 'Identity binding' UI-tekst (accordion-header)"
    # Drie radio's voor mode.
    for val in ("none", "generate", "import"):
        assert re.search(
            rf"name=['\"]identity-mode['\"][\s\S]{{0,200}}value=['\"]{val}['\"]",
            src,
        ), f"identity-mode radio met value='{val}' ontbreekt"
    # Download-knop hint.
    assert "Download private key" in src, "Sign-modus mist Download-knop voor private key"


# ---------- app.js state + flow ---------------------------------------------


def test_app_js_has_identity_state() -> None:
    src = APP_JS.read_text(encoding="utf-8")
    assert re.search(r"identity\s*:\s*\{", src), \
        "app.js#hashing.identity state ontbreekt"
    for key in (
        "mode", "keyName", "keyEmail", "passphrase",
        "importedAsc", "generated", "importedRef", "downloaded", "busy", "error",
    ):
        assert re.search(rf"\b{key}\s*:", src), \
            f"hashing.identity mist veld '{key}'"


def test_app_js_calls_sign_envelope() -> None:
    src = APP_JS.read_text(encoding="utf-8")
    assert re.search(r"Id\.signEnvelope\s*\(", src), \
        "app.js#runHash roept Id.signEnvelope niet aan"
    assert re.search(r"Id\.verifyEnvelope\s*\(", src) or \
        re.search(r"Identity\s*\.\s*verifyEnvelope\s*\(", src), \
        "app.js#runVerify roept verifyEnvelope niet aan"


def test_app_js_passphrase_cleared_after_sign() -> None:
    """Security: passphrase MOET na sign uit memory."""
    src = APP_JS.read_text(encoding="utf-8")
    # In runHash na signEnvelope MOET id.passphrase = '' gezet worden.
    m = re.search(r"signEnvelope[\s\S]{0,800}passphrase\s*=\s*['\"]['\"]", src)
    assert m, "app.js wist passphrase niet na signEnvelope"


def test_app_js_bumps_schema_to_v3_on_sign() -> None:
    src = APP_JS.read_text(encoding="utf-8")
    assert re.search(r"poa_schema\s*=\s*['\"]poa-v3['\"]", src), \
        "app.js moet meta.poa_schema = 'poa-v3' zetten bij identity-sign"


def test_app_js_verdict_downgrade_on_invalid_signature() -> None:
    """Aanwezige maar ongeldige signature → verdict NO_MATCH."""
    src = APP_JS.read_text(encoding="utf-8")
    # Zoek het downgrade-blok rond identityResult.present + valid === false.
    m = re.search(
        r"identityResult\.present[\s\S]{0,200}valid\s*===\s*false[\s\S]{0,200}NO_MATCH",
        src,
    )
    assert m, "app.js mist verdict-downgrade naar NO_MATCH bij ongeldige identity"


def test_app_js_force_download_before_sign() -> None:
    """Generate-modus: sign mag pas ná download van private key."""
    src = APP_JS.read_text(encoding="utf-8")
    assert re.search(r"downloaded\s*=\s*true", src), \
        "app.js#identityGenerateAndDownload moet downloaded=true zetten na blob-download"
    # Sign-gate: in identitySignReady() of in runHash() MOET id.downloaded gechecked worden.
    gate = re.search(r"identitySignReady\s*\(\s*\)\s*\{[\s\S]*?\n    \},", src)
    assert gate, "identitySignReady() functie niet gevonden"
    assert "downloaded" in gate.group(0), \
        "identitySignReady() moet expliciet id.downloaded checken (generate-modus gate)"
    # Bovendien: in runHash() bij mode==='generate' moet downloaded gechecked worden.
    rh = re.search(r"if\s*\(\s*id\.mode\s*===\s*['\"]generate['\"][\s\S]{0,800}downloaded", src)
    assert rh, "runHash() moet bij generate-modus id.downloaded checken vóór sign"


# ---------- poa-report.js identity section ----------------------------------


def test_poa_report_has_identity_section_claim_v2() -> None:
    src = POA_JS.read_text(encoding="utf-8")
    m = re.search(
        r"function\s+buildClaimV2\b[\s\S]+?return\s+await\s+doc\.save",
        src,
    )
    assert m, "buildClaimV2-body niet gevonden"
    body = m.group(0)
    assert "Identity binding" in body, \
        "buildClaimV2 mist 'Identity binding' sectie"
    assert re.search(r"signature", body), \
        "buildClaimV2 identity-sectie refereert niet aan meta.signature"


def test_poa_report_has_identity_section_match() -> None:
    src = POA_JS.read_text(encoding="utf-8")
    m = re.search(
        r"function\s+buildMatchReport\b[\s\S]+?return\s+await\s+doc\.save",
        src,
    )
    assert m, "buildMatchReport-body niet gevonden"
    body = m.group(0)
    # Identity-sectie + uitleg over first-owner bewijs.
    assert re.search(r"Identity\b", body), \
        "buildMatchReport mist 'Identity' sectie"
    assert "first-owner" in body or "first owner" in body.lower(), \
        "buildMatchReport identity-sectie mist first-owner uitleg"


# ---------- i18n keys -------------------------------------------------------


def test_i18n_has_identity_keys() -> None:
    data = json.loads(I18N_JSON.read_text(encoding="utf-8"))
    text = data.get("text", {})
    required_substrings = [
        "Identity binding",
        "Genereer nieuwe sleutel",
        "Importeer bestaande",
        "Fingerprint:",
        "Identity:",
        "niet geclaimd",
        "HorseSafe",
        "Passphrase",
    ]
    keys = list(text.keys())
    for needle in required_substrings:
        assert any(needle in k for k in keys), \
            f"i18n.json mist sleutel met substring '{needle}'"


# ---------- version.json -----------------------------------------------------


def test_version_bumped_to_0_25_0_shamir() -> None:
    vj = ROOT / "version.json"
    data = json.loads(vj.read_text(encoding="utf-8"))
    assert data.get("version") == "0.25.0", \
        f"version.json moet '0.25.0' zijn, kreeg '{data.get('version')}'"
    assert data.get("codename") == "Shamir", \
        f"version.json codename moet 'Shamir' zijn, kreeg '{data.get('codename')}'"
