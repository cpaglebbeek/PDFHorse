# PDFHorse — UI screens

Headless-screenshot-set van LIVE `https://horsecloud55.ddns.net/PDFHorse/`.
Genereer-script: [`../../scripts/take_screens.py`](../../scripts/take_screens.py)
(Playwright headless Chromium, viewport 1440×900, retina ×2).

Sluit het Fysiek-Functioneel gat uit `/sanitycheck` v0.7.0-Knuth.

## Set v0.9.1-Mittelbach (2026-06-14)

| # | Bestand | Tab | Wat |
|---|---|---|---|
| 00 | [`00_overview.png`](00_overview.png) | (Merge default) | Landing — header, hero, tab-nav, drop-zone, output-bar (leeg), footer met health-status |
| 01 | [`01_merge.png`](01_merge.png) | Merge | PDF + .docx samenvoegen — v0.1.0-Geschke + v0.6.0-Paxton |
| 02 | [`02_split.png`](02_split.png) | Split | PDF opdelen op page-ranges — v0.2.0-Wozencraft |
| 03 | [`03_fill.png`](03_fill.png) | Invullen | Tekstvelden vrij plaatsen op PDF — v0.3.0-Putman |
| 04 | [`04_sign.png`](04_sign.png) | Ondertekenen | Handtekening 3 modi (bitmap/SVG/live) — v0.4.0-Taft |
| 05 | [`05_convert.png`](05_convert.png) | Converteren | .docx · .xlsx · .odt · .rtf · .png · .jpg → PDF — v0.7.0-Knuth + v0.9.1-Mittelbach |
| 06 | [`06_ocr.png`](06_ocr.png) | OCR | Gescande PDF doorzoekbaar (NL+EN) — v0.8.0-Reid |

## Re-genereren

```bash
source .venv/bin/activate
python3 scripts/take_screens.py
```

Vereist eenmalig: `pip install playwright && python3 -m playwright install chromium`.

## Niet (nog) gedaan

Per-tab "in-use"-screenshots (lijst met geladen bestanden, getekende handtekening, output-bar met mail-form open) vereisen file-uploads via Playwright met dummy-PDF's. Volgende uitbreiding van het script — niet blocker voor v0.9.1.

## Privacy-overweging

Headless-runs gebruiken geen echte gebruiker-content; screens tonen lege drop-zones en placeholder-states.
