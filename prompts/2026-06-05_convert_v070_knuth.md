---
date: 2026-06-05
repo: PDFHorse
status: open
resume: "verder met pdfhorse — OCR backend (Tesseract install + ocrmypdf endpoint) na v0.7.0-Knuth Convert-tab"
---

# Sessie 2026-06-05 — v0.7.0-Knuth: Convert-tab (docx/xlsx/png/jpg → PDF + Combine)

**Agent:** Claude Opus 4.7 (1M context)
**Repo:** PDFHorse + HC55 redeploy + apt libreoffice-calc
**LIVE URL:** `https://horsecloud55.ddns.net/PDFHorse/`

## Opdracht

"feature: convert: docx/xlsx/png/jpg to pdf, of combinatie naar multiple pdf". WhatIf met 3 design-keuzes → akkoord op aparte tab + client-side image + Knuth codename.

## Architectuur

| Type | Routing | Reden |
|---|---|---|
| .docx | bestaand `/api/convert/docx-to-pdf` | LibreOffice fidelity |
| .xlsx | NIEUW `/api/convert/xlsx-to-pdf` | LibreOffice fidelity (sheets, cellen) |
| .png  | client pdf-lib `embedPng` op A4 fit-to-page | P1 client-first geldt |
| .jpg  | client pdf-lib `embedJpg` op A4 fit-to-page | P1 client-first geldt |

Backend DRY: `convert_docx_to_pdf` body → `_office_to_pdf(file, ext, mime, max_bytes)` helper. Docx-route blijft API-compatibel.

## Uitgevoerd

- `version.json` → 0.7.0 / Knuth / convert-tab
- `backend/main.py`:
  - `MAX_XLSX_BYTES = 20MB` + `XLSX_MIME` constante
  - `_office_to_pdf` private helper (extract uit docx-endpoint)
  - `/api/convert/docx-to-pdf` blijft (delegeert naar helper)
  - `/api/convert/xlsx-to-pdf` NIEUW (delegeert naar helper)
- `backend/tests/test_health.py`: 2 nieuwe tests (415 non-xlsx, 503 zonder soffice)
- `frontend/index.html`:
  - header v0.7.0 — Knuth
  - tab-nav `Converteren` toegevoegd tussen Ondertekenen en OCR
  - section met drop-zone (accept docx+xlsx+png+jpg+jpeg), file-list met kleur-badges (blauw/emerald/amber), ↑/↓/✕ reorder, "Combineer alle tot 1 PDF"-checkbox, progress-knop
- `frontend/js/app.js`:
  - tab-array uitgebreid; `convert`-state
  - `MAX_XLSX_BYTES`, `MAX_IMAGE_BYTES`, `XLSX_MIME` constanten
  - `_convertDetectKind(f)` → 'docx' | 'xlsx' | 'png' | 'jpg' | null
  - `_convertAddFiles`, `convertMove/Remove/Reset`
  - `_imageToPdf(file, kind)` client-side: nieuwe A4-PDF, `embedPng`/`embedJpg`, fit-to-A4 met 36pt margin, aspect-ratio behouden, centered
  - `_officeToPdf(file, kind)` server-call (delegeert per route)
  - `runConvert()` met `combine`-pad (pdf-lib copyPages naar gedeeld doc → 1 download "converted.pdf") en multi-output-pad (N losse downloads "<basename>.pdf" met 200ms delay)
  - Output-bar krijgt laatste PDF + feature-label "convert (N bestanden gecombineerd)" of "convert (N bestanden, laatste getoond)"

- Docs:
  - ACTIONS: Convert-tab afgevinkt, sectie v0.7.0 → v0.8.0
  - CHANGELOG: v0.7.0-Knuth entry
  - DEPENDENCIES: libreoffice-calc toegevoegd + v0.7.0 historie-rij
  - PRIVACY: Office-paragraaf gegeneraliseerd voor docx+xlsx, nieuwe PNG/JPG-paragraaf (client-only)

- Sessie-MDs:
  - 2026-06-05_docx_merge_v060_paxton.md → done
  - 2026-06-05_convert_v070_knuth.md NIEUW

## Tests

- pytest 9/9 (7 oud + 2 nieuw xlsx)
- node --check OK
- HC55 e2e xlsx smoke pas mogelijk na libreoffice-calc install (geen lokale soffice)

## HC55 deploy-stappen

1. `apt install libreoffice-calc` (~80MB)
2. `git pull` op `/opt/pdfhorse`
3. `rsync frontend/` → `/var/www/pdfhorse/frontend/`
4. `systemctl restart pdfhorse`
5. Smoke: `/api/health` toont 0.7.0/Knuth; xlsx-conversie via curl

## Belangrijke keuzes

| Keuze | Reden |
|---|---|
| Gedeelde `_office_to_pdf` helper i.p.v. dupliceren | DRY; alle conversie-logica op één plek; toekomstige formaten (odt/rtf/pptx) eenvoudig toe te voegen |
| Client-side image i.p.v. server | P1 client-first; geen netwerk-call nodig voor pure image-to-PDF |
| Fit-to-A4 i.p.v. native image-dimensies | Voorspelbare PDF-grootte; foto's 4000px @ 72dpi zou 4m paper geven |
| 36pt margin (≈ 0.5 inch) | Standaard document-marge, oogt niet "ingedrukt tot rand" |
| Combine via copyPages binnen runConvert | Hergebruikt pdf-lib pattern uit merge; geen extra abstractie |
| 200ms delay tussen N downloads | Popup-blocker mitigation, zoals split |
| Knuth als codename | TeX-pionier; document-typografie-symbool; afwijkend van Adobe maar gedocumenteerd |

## Open

- **OCR backend** (resume-trigger): Tesseract install + endpoint
- **Mail backend**: Hostinger mailbox-creds
- **Andere formaten** (.odt, .rtf, .pptx): kunnen via dezelfde helper
- **icthorse.nl-mirror**, **docs/screens/**, **SRI-hashes**, **nginx-cleanup**: open van eerdere rondes
