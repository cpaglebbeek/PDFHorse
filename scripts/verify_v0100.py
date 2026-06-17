"""Headless live-verificatie v0.10.0-Thanh op HC55.

Test op https://horsecloud55.ddns.net/PDFHorse/:
  1. Pagina laadt zonder console/page errors.
  2. Header toont v0.10.0 — Thanh.
  3. Alle 6 tabs schakelbaar via goTab (geen error).
  4. Fill -> Sign overdracht: PDF invullen, signHandoff gezet, "Onderteken deze
     PDF"-knop laadt de ingevulde PDF in de Ondertekenen-tab.
  5. Geplaatste handtekening is versleepbaar (positie wijzigt na muis-drag).

Run: ~/projects/PDFHorse/.venv/bin/python scripts/verify_v0100.py
"""
import sys
from playwright.sync_api import sync_playwright

URL = "https://horsecloud55.ddns.net/PDFHorse/"
TEST_PDF = "/tmp/pdfhorse_test.pdf"

errors = []      # console/page errors
results = []     # (naam, ok, detail)


def check(name, ok, detail=""):
    results.append((name, ok, detail))


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(ignore_https_errors=True, viewport={"width": 1280, "height": 1000})
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

    page.goto(URL, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(800)  # Alpine + CDN libs settelen

    # 2. versie
    header = page.inner_text("header")
    check("Header v0.10.0 — Thanh", "v0.10.0 — Thanh" in header, header.replace("\n", " ")[:80])

    # 3. tabs schakelen via goTab
    for label in ["Split", "Invullen", "Ondertekenen", "Converteren", "OCR", "Merge"]:
        page.click(f'button[role=tab]:has-text("{label}")')
        page.wait_for_timeout(120)
    active = page.evaluate("Alpine.$data(document.querySelector('[x-data]')).active")
    check("Tabs schakelbaar (eindigt op merge)", active == "merge", f"active={active}")

    # 4. Fill -> Sign overdracht
    page.click('button[role=tab]:has-text("Invullen")')
    page.set_input_files("#fill-file-input", TEST_PDF)
    page.wait_for_selector("#fill-canvas-0", timeout=15000)
    page.wait_for_timeout(600)
    page.click("#fill-canvas-0", position={"x": 120, "y": 120})
    page.wait_for_timeout(150)
    page.fill('section[aria-labelledby="tab-fill"] input[type=text]', "Testwaarde")
    page.click('button:has-text("Download invulde PDF")')
    page.wait_for_timeout(700)
    handoff = page.evaluate(
        "() => { const d = Alpine.$data(document.querySelector('[x-data]'));"
        "return d.signHandoff ? {name: d.signHandoff.name, len: d.signHandoff.bytes.length} : null; }"
    )
    check("signHandoff gezet na Invullen", bool(handoff and handoff["name"].endswith("_filled.pdf")), str(handoff))

    page.click('button:has-text("Onderteken deze PDF")')
    # Pagina-canvases staan x-show="sign.dataUrl" (verborgen tot handtekening
    # gekozen), maar worden wél gerenderd. Wacht op de geladen sign-state.
    page.wait_for_function(
        "() => Alpine.$data(document.querySelector('[x-data]')).sign.pageCount === 2",
        timeout=15000,
    )
    page.wait_for_timeout(400)
    sign_state = page.evaluate(
        "() => { const d = Alpine.$data(document.querySelector('[x-data]'));"
        "return {active: d.active, name: d.sign.file && d.sign.file.name, pages: d.sign.pageCount, handoff: d.signHandoff}; }"
    )
    check(
        "Fill->Sign: ingevulde PDF geladen in sign-tab",
        sign_state["active"] == "sign" and sign_state["pages"] == 2
        and (sign_state["name"] or "").endswith("_filled.pdf") and sign_state["handoff"] is None,
        str(sign_state),
    )

    # 5. Verslepen geplaatste handtekening
    # Zet een dummy-handtekening (klein PNG via canvas) en plaats er één.
    page.evaluate(
        "() => { const c = document.createElement('canvas'); c.width=120; c.height=48;"
        "const g = c.getContext('2d'); g.fillStyle='#1d4ed8'; g.fillRect(0,0,120,48);"
        "const d = Alpine.$data(document.querySelector('[x-data]'));"
        "d.sign.dataUrl = c.toDataURL('image/png'); d.sign.width = 120; }"
    )
    page.wait_for_selector("#sign-canvas-0", state="visible", timeout=10000)
    page.wait_for_timeout(200)
    page.click("#sign-canvas-0", position={"x": 100, "y": 100})
    page.wait_for_timeout(150)
    before = page.evaluate("() => { const p = Alpine.$data(document.querySelector('[x-data]')).sign.placements[0]; return p ? {x:p.x,y:p.y} : null; }")
    img = page.query_selector('section[aria-labelledby="tab-sign"] img[draggable="false"]')
    placed_ok = before is not None and img is not None
    moved_ok = False
    if placed_ok:
        box = img.bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down()
        page.mouse.move(box["x"] + box["width"] / 2 + 70, box["y"] + box["height"] / 2 + 50, steps=8)
        page.mouse.up()
        page.wait_for_timeout(150)
        after = page.evaluate("() => { const p = Alpine.$data(document.querySelector('[x-data]')).sign.placements[0]; return {x:p.x,y:p.y}; }")
        moved_ok = abs(after["x"] - before["x"]) > 30 and abs(after["y"] - before["y"]) > 20
        detail = f"voor={before} na={after}"
    else:
        detail = f"plaatsing mislukt (before={before}, img={'ja' if img else 'nee'})"
    check("Handtekening geplaatst", placed_ok, detail)
    check("Handtekening versleepbaar (positie wijzigt)", moved_ok, detail)

    browser.close()

# Rapport
print("\n=== Verificatie v0.10.0-Thanh ===")
all_ok = True
for name, ok, detail in results:
    flag = "PASS" if ok else "FAIL"
    if not ok:
        all_ok = False
    print(f"[{flag}] {name}" + (f"  — {detail}" if detail and not ok else ""))

print(f"\nConsole/page errors: {len(errors)}")
for e in errors:
    print("  -", e)
    if "tailwind" not in e.lower():  # Tailwind Play CDN waarschuwt soms benign
        all_ok = False

print("\nRESULTAAT:", "ALLES GROEN" if all_ok and not errors else ("GROEN (alleen benign warnings)" if all_ok else "ER ZIJN FAILS"))
sys.exit(0 if all_ok else 1)
