"""Genereert docs/screens/*.png via Playwright headless Chromium.

Loopt door alle 6 tabs op https://horsecloud55.ddns.net/PDFHorse/ en schiet
een PNG per tab. Wordt incidenteel handmatig gerund (bij UI-wijziging).

Run:
    source .venv/bin/activate
    python3 scripts/take_screens.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "https://horsecloud55.ddns.net/PDFHorse/"
OUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "screens"
VIEWPORT = {"width": 1440, "height": 900}
DEVICE_SCALE = 2  # retina

TABS = [
    # (tab_label, filename, settle_ms_extra) — label = accessible name op role=tab
    (None,            "00_overview.png", 0),    # landing (default = merge actief)
    ("Merge",         "01_merge.png", 0),
    ("Split",         "02_split.png", 0),
    ("Invullen",      "03_fill.png", 0),
    ("Ondertekenen",  "04_sign.png", 150),      # signature_pad lazy-init
    ("Converteren",   "05_convert.png", 0),
    ("OCR",           "06_ocr.png", 0),
]


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport=VIEWPORT, device_scale_factor=DEVICE_SCALE)
        page = ctx.new_page()
        print(f"→ navigating {URL}")
        page.goto(URL, wait_until="networkidle", timeout=30_000)
        page.wait_for_selector('[role="tablist"]', timeout=10_000)
        # Alpine is `defer` — geef event-loop een tick om x-show te resolven
        page.wait_for_timeout(500)
        # Wacht tot footer health-state actueel is (was '…' bij init, wordt 'ok')
        page.wait_for_function(
            "() => document.body.innerText.includes('Server: ok')",
            timeout=10_000,
        )

        for tab_label, filename, extra_ms in TABS:
            target = OUT_DIR / filename
            if tab_label is not None:
                page.get_by_role("tab", name=tab_label).click()
                page.wait_for_timeout(250 + extra_ms)
            page.screenshot(path=str(target), full_page=True)
            print(f"  ✓ {filename}  ({target.stat().st_size:,} bytes)")

        browser.close()
    print(f"\nDone — {len(TABS)} screenshots in {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
