---
date: 2026-06-05
repo: PDFHorse
status: done
resume: ""
---

# Sessie 2026-06-05 — v0.6.0-Paxton: server-side docx → PDF + Merge accepteert docx

**Agent:** Claude Opus 4.7 (1M context)
**Repo:** PDFHorse + HC55 redeploy + apt install LibreOffice
**LIVE URL:** `https://horsecloud55.ddns.net/PDFHorse/`

## Opdracht

Eerste user-vraag in 2026-06-05 sessie: "ondersteun ook mergen van pdf EN docx (naar pdf)". WhatIf gepresenteerd → akkoord op server-side via LibreOffice headless. Implementatie.

## Architectuur-keuze

**Server-side via LibreOffice headless**, niet client-side (mammoth.js / docx-preview).

Reden: client-side libs hebben slechte format-fidelity (tabellen / fonts / headers verloren). LibreOffice is industrie-standaard met hoge fidelity.

P1 ("client als kan, server als moet") reconciliatie: docx vereist server omdat fidelity client-only niet haalbaar is — zelfde reden als OCR.
P3 + P4: docx → /tmp/pdfhorse/<uuid>/ → soffice → response → BackgroundTask shutil.rmtree. Geen inhouds-log.

## Uitgevoerd

- `version.json` → 0.6.0 / Paxton / docx-merge
- `frontend/index.html`:
  - header v0.6.0 — Paxton
  - merge-uitleg + accept-attribute uitgebreid (`.pdf` + `.docx` + MIME `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
  - file-list toont kleur-badge `[PDF]` / `[DOCX]` per file
  - "Samenvoegen"-knop toont progress-tekst tijdens conversie/merging
  - Totaal-regel toont "N docx vereisen server-conversie"
- `frontend/js/app.js`:
  - `MAX_DOCX_BYTES = 20 MB` + `DOCX_MIME` constante
  - `merge.progress` state-veld
  - `_detectKind(f)` → 'pdf' | 'docx' | null
  - `_mergeAddFiles` accepteert beide types met aparte size-limits (50MB PDF / 20MB docx)
  - `_convertDocxToPdf(blob)` POST `/api/convert/docx-to-pdf` multipart → response.arrayBuffer → Uint8Array
  - `runMerge` uitgebreid: per-file kind-check, docx → convert call met progress-tekst, PDF → directe arrayBuffer, dan mergen via pdf-lib zoals voorheen
  - Output-bar feature-label markeert "X× docx geconverteerd"
- `backend/main.py`:
  - `convert_docx_to_pdf` endpoint met:
    - filename + content-type validatie (.docx of MIME)
    - Chunked read tot 20MB → 413 boven limiet
    - Lege upload → 400
    - Werkmap `TMP_DIR / uuid.uuid4().hex`
    - `soffice -env:UserInstallation=file://...` (voorkomt concurrente conflicts) `--headless --convert-to pdf --outdir`
    - returncode != 0 → 502
    - PDF ontbreekt → 502
    - TimeoutExpired (60s default) → 504
    - FileNotFoundError → 503 "LibreOffice niet beschikbaar"
    - FileResponse met BackgroundTask shutil.rmtree
  - `MAX_DOCX_BYTES` + `SOFFICE_BIN` + `SOFFICE_TIMEOUT_S` env vars
- `backend/tests/test_health.py`: 3 nieuwe tests (415 non-docx, 400 leeg, 503 zonder soffice via monkeypatch)
- `ARCHITECTURE.md`: Merge-flow geactualiseerd met conversie-stap; endpoints-tabel uitgebreid
- `docs/DEPENDENCIES.md`: LibreOffice als backend OS-dep + historie v0.5.0 + v0.6.0
- `docs/PRIVACY.md`: docx-conversie expliciet (server, /tmp, BackgroundTask cleanup, geen content-log) + bewaartermijn-rij + LibreOffice in doorgifte
- `ACTIONS.md` docx-support afgevinkt, sectie v0.6.0 → v0.7.0
- `CHANGELOG.md` v0.6.0-Paxton entry bovenaan
- prompts/2026-06-04_output_v050_crocker.md → status done
- prompts/2026-06-05_docx_merge_v060_paxton.md NIEUW

## Tests

- **pytest 7/7 groen** (4 oud + 3 nieuw docx-endpoint)
- `node --check` op app.js OK
- Smoke met echte docx pas op HC55 mogelijk (geen LibreOffice op Mac)

## Belangrijke keuzes

| Keuze | Reden |
|---|---|
| LibreOffice headless ipv mammoth.js | Format-fidelity (tabellen, fonts, headers) onmisbaar voor zakelijke docs |
| Alleen Merge (niet split/fill/sign) accepteert docx in v0.6.0 | Kleinste blast-radius; consistent met "merge = samenvoegen van wat dan ook" |
| Max 20MB docx vs 50MB PDF | Conversie is RAM-intensiever; conservatieve grens vermijdt OOM |
| BackgroundTask voor cleanup | Werkmap pas weg na FileResponse-stream klaar; vermijdt race-condition |
| `-env:UserInstallation` per uuid | Concurrente requests krijgen elk hun eigen soffice-profile dir |
| Timeout 60s default | Genoeg voor reguliere docx; veiligheidsnet tegen hanging conversies |
| FileNotFoundError → 503 (nette melding) | Frontend toont "LibreOffice niet beschikbaar" ipv generieke 500 |
| Geen client-side fallback bij 503 | Eerst infra fixen; lapwerk-fallback verbergt deploy-issues |

## HC55 deploy-stappen (tijdens deze sessie)

1. `apt install libreoffice-core libreoffice-writer` (~500MB) — eerste backend OS-dep buiten Python
2. `git pull` op `/opt/pdfhorse`
3. `rsync frontend/` → `/var/www/pdfhorse/frontend/`
4. `systemctl restart pdfhorse`
5. Publieke smoke: `curl /api/health` → 0.6.0 / Paxton
6. Echte docx-conversie smoke: upload docx via `curl -F file=@...` → bytes met PDF-header
7. Regressie-check: HorseSafe + Dashboard intact

## Open

- **OCR backend** (resume-trigger v0.6.0): Tesseract install + ocrmypdf endpoint
- **Mail backend**: wacht op Hostinger mailbox-creds
- **icthorse.nl/PDFHorse/**: reverse-proxy aparte sessie
- **docs/screens/**: screenshots vanaf live URL
- **SRI-hashes** op CDN-scripts
- **HC55 nginx-cleanup**: `.bak`-files in sites-enabled
- **Andere office-formaten** (.odt, .rtf, .xlsx) — v0.6.x kan dezelfde endpoint hergebruiken met andere accept-types
- **Streaming docx-conversie** — voor zeer grote docs, gepland v0.7.x
