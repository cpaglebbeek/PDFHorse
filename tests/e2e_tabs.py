#!/usr/bin/env python3
"""
PDFHorse E2E — Watermerk- en Geavanceerd-tab (Playwright, headless Chromium).

Dekt 3 echte round-trips door de UI:
  1. Watermerk: tekst toevoegen -> download -> lezen vindt payload-tekst terug.
  2. Geavanceerd: payload (plain) inbedden -> uithalen == origineel (byte-exact).
  3. Geavanceerd: payload (encrypted, keypair) inbedden -> ontsleutelen == origineel.

Vereist een secure context voor WebCrypto -> draai tegen https:// of http://localhost.
De sample-PDF wordt in-browser gegenereerd via window.PDFLib (geen externe fixtures).

Setup:
  python3 -m venv pwenv && ./pwenv/bin/pip install playwright && ./pwenv/bin/playwright install chromium
Draaien (serveer eerst frontend/, bv. `python -m http.server 8099 --bind 127.0.0.1` in frontend/):
  PDFHORSE_URL=http://127.0.0.1:8099/ ./pwenv/bin/python tests/e2e_tabs.py
"""
import os, sys, tempfile, pathlib
from playwright.sync_api import sync_playwright

BASE = os.environ.get("PDFHORSE_URL", "http://127.0.0.1:8099/")
TMP = pathlib.Path(tempfile.mkdtemp(prefix="pdfh-e2e-"))
PAYLOAD = TMP / "payload.bin"
PAYLOAD_BYTES = b"Geheime payload \xff\x00\x80 - PDFHorse e2e"
PAYLOAD.write_bytes(PAYLOAD_BYTES)

results = []
def check(name, ok, extra=""):
    results.append(ok); print(("PASS" if ok else "FAIL"), "-", name, ("| " + extra) if extra else "")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_context(accept_downloads=True).new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console.error: " + m.text)
            if m.type == "error" and "404" not in m.text else None)

    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_function("() => !!window.PDFLib && !!window.PDFHorseWatermark && !!window.PDFHorsePayload", timeout=15000)

    # Genereer een echte sample-PDF in-browser via window.PDFLib.
    pdf_b64 = page.evaluate("""async () => {
        const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pg = doc.addPage([400, 300]);
        pg.drawText('PDFHorse test document', { x: 40, y: 240, size: 16, font, color: rgb(0,0,0) });
        const b = await doc.save();
        let s=''; b.forEach(c => s += String.fromCharCode(c)); return btoa(s);
    }""")
    import base64
    SAMPLE = str(TMP / "sample.pdf"); (TMP / "sample.pdf").write_bytes(base64.b64decode(pdf_b64))

    def tab(sub): page.locator('nav[role="tablist"] button', has_text=sub).first.click()
    WM = page.locator('section[aria-labelledby="tab-watermerk"]')
    AV = page.locator('section[aria-labelledby="tab-geavanceerd"]')

    # TEST 1 — Watermerk tekst -> lezen
    WM_TEXT = "GEHEIM-WM-12345"
    try:
        tab("Watermerk")
        page.set_input_files("#watermark-file-input", SAMPLE)
        page.get_by_placeholder("bv. Vertrouwelijk").fill(WM_TEXT)
        with page.expect_download(timeout=30000) as di:
            WM.get_by_role("button", name="Watermerk toevoegen", exact=True).click()
        wm = TMP / "wm.pdf"; di.value.save_as(str(wm))
        check("watermerk: tekst toevoegen -> download", wm.stat().st_size > 0, f"{wm.stat().st_size} bytes")
        WM.get_by_role("button", name="Ander bestand", exact=True).click()
        page.set_input_files("#watermark-file-input", str(wm))
        WM.get_by_role("button", name="Lezen", exact=True).click()
        WM.get_by_role("button", name="Watermerk lezen", exact=True).click()
        page.get_by_text(WM_TEXT, exact=False).first.wait_for(timeout=30000)
        check("watermerk: lezen vindt payload-tekst terug", True, WM_TEXT)
    except Exception as e:
        check("watermerk round-trip", False, repr(e)[:160])

    # TEST 2 — payload plain
    try:
        tab("Geavanceerd")
        AV.get_by_role("button", name="Payload inbedden", exact=True).click()
        page.set_input_files("#adv-pdf-input", SAMPLE)
        page.set_input_files("#adv-payload-input", str(PAYLOAD))
        with page.expect_download(timeout=30000) as di:
            AV.locator("button", has_text="& PDF downloaden").click()
        emb = TMP / "embed_plain.pdf"; di.value.save_as(str(emb))
        AV.get_by_role("button", name="Payload uithalen", exact=True).click()
        page.set_input_files("#adv-pdf-input-ex", str(emb))
        with page.expect_download(timeout=30000) as di:
            AV.locator("button", has_text="& downloaden").click()
        ext = TMP / "ext_plain.bin"; di.value.save_as(str(ext))
        check("payload plain: uithalen == origineel (byte-exact)", ext.read_bytes() == PAYLOAD_BYTES)
    except Exception as e:
        check("payload plain round-trip", False, repr(e)[:160])

    # TEST 3 — payload encrypted (keypair)
    try:
        tab("Geavanceerd")
        AV.get_by_role("button", name="Sleutels", exact=True).click()
        AV.get_by_role("button", name="Keypair aanmaken", exact=True).click()
        page.get_by_text("Keypair aangemaakt", exact=False).wait_for(timeout=30000)
        with page.expect_download(timeout=30000) as di:
            AV.locator("button", has_text="Public key downloaden").click()
        pub = TMP / "pub.json"; di.value.save_as(str(pub))
        page.set_input_files("#adv-peer-input", str(pub))
        page.get_by_text("Peer public key geladen", exact=False).wait_for(timeout=10000)
        AV.get_by_role("button", name="Payload inbedden", exact=True).click()
        page.set_input_files("#adv-pdf-input", SAMPLE)
        page.set_input_files("#adv-payload-input", str(PAYLOAD))
        AV.locator('input[type="checkbox"]').check()
        with page.expect_download(timeout=30000) as di:
            AV.locator("button", has_text="& PDF downloaden").click()
        embe = TMP / "embed_enc.pdf"; di.value.save_as(str(embe))
        AV.get_by_role("button", name="Payload uithalen", exact=True).click()
        page.set_input_files("#adv-pdf-input-ex", str(embe))
        with page.expect_download(timeout=30000) as di:
            AV.locator("button", has_text="& downloaden").click()
        exte = TMP / "ext_enc.bin"; di.value.save_as(str(exte))
        check("payload enc: ontsleuteld == origineel (byte-exact)", exte.read_bytes() == PAYLOAD_BYTES)
    except Exception as e:
        check("payload encrypted round-trip", False, repr(e)[:160])

    browser.close()

print("\nJS errors (excl. /api 404):", "\n".join(errors) if errors else "(geen)")
passed = sum(1 for ok in results if ok)
print(f"=== {passed}/{len(results)} checks PASS ===")
sys.exit(0 if results and passed == len(results) else 1)
