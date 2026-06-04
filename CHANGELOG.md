# Changelog — PDFHorse

> Versie-historie. Formaat: [Keep a Changelog](https://keepachangelog.com/) op hoofdlijnen, met PDFHorse-eigen codenamen (thema: PDF-pioniers).
> Bijgewerkt bij elke release. Datums = release naar `main`.

## [v0.6.0-Paxton] — 2026-06-05

### Added
- **DOCX-support in Merge-tab** — sleep nu ook Word-documenten (`.docx`) naast PDF's; ze worden server-zijde naar PDF geconverteerd en daarna mee-gemerged
- **Backend endpoint `POST /api/convert/docx-to-pdf`** — accepteert multipart upload, draait `soffice --headless --convert-to pdf` op een uniek `/tmp/pdfhorse/<uuid>/` werkpad, retourneert PDF, en ruimt het werkpad op via `BackgroundTask` (`shutil.rmtree`)
- File-list in Merge toont kleur-badge `[PDF]` / `[DOCX]` per bestand
- Progress-tekst tijdens `runMerge`: "Converteert docx 1/N…" → "Verwerkt PDF…" → "Samenvoegen…"
- Telt aan onderkant van de Merge-knop hoeveel docx-files server-conversie vereisen

### Changed
- `frontend/index.html` header → v0.6.0 — Paxton
- `version.json` → 0.6.0 / Paxton / docx-merge
- `frontend/js/app.js`: `merge.progress` state + `_detectKind()` + `_convertDocxToPdf()` + uitgebreide `runMerge()`
- `backend/main.py`: `convert_docx_to_pdf` + `MAX_DOCX_BYTES` (20MB) + `SOFFICE_TIMEOUT_S` (60s) + `SOFFICE_BIN` env override
- `ARCHITECTURE.md` Merge-flow geactualiseerd; nieuwe endpoint in tabel
- `docs/DEPENDENCIES.md`: LibreOffice als backend OS-dep + v0.5.0/v0.6.0 historie-rijen
- `docs/PRIVACY.md`: docx-conversie-flow expliciet vermeld (server-zijde, direct gewist, geen content-log)

### Tests
- pytest 7/7 groen — 3 nieuwe tests voor het convert-endpoint:
  - 415 op niet-docx upload
  - 400 op lege upload
  - 503 als `soffice` ontbreekt (FileNotFoundError → nette melding)

### Limieten
- Max **20 MB** per docx (lager dan PDF 50 MB; conversie is RAM-intensiever)
- LibreOffice timeout: 60s

### Codename
**Bill Paxton** — Adobe engineer, mede-architect Adobe Type Manager + PostScript Type 1 font-tooling. Past in PDF-pioniers-thema; Brotz blijft gereserveerd voor v1.0.0.

---

## [v0.5.0-Crocker] — 2026-06-04

### Added
- **Output-bar** onderaan elke tab — persistente "laatste uitvoer"-state met filename + bron-feature + grootte
- **Download-knop** — re-trigger van laatste output (geen nieuwe verwerking nodig)
- **Print-knop** — hidden iframe met blob-URL + `contentWindow.print()` (cross-browser werkend, blob-URL automatisch opgeruimd na 60s)
- **Mail-knop + form** — recipient + subject inputs, POST naar `/api/mail` multipart met PDF-blob, 501-stub nette UX-melding tot Hostinger mailbox actief is
- Alle 4 features (merge/split/fill/sign) schrijven nu naar `_setOutput(bytes, filename, feature)` naast hun auto-download
- Split-N-outputs: laatste range wordt de "primaire" voor de output-bar

### Changed
- `frontend/index.html` header → v0.5.0 — Crocker
- `version.json` → 0.5.0 / Crocker / fifth-feature
- `ARCHITECTURE.md` mail-flow geactualiseerd + nieuwe Output-bar data-flow

### Notes
- **OCR + Mail backend blijven 501-stubs** op deze versie. Mail-form werkt eind-tot-eind in de frontend; backend-implementatie wacht op Hostinger mailbox `pdfservice@icthorse.nl` (gebruikersactie).

### Codename
**Steve Crocker** — niet de PDF-uitvinder, maar internet-pionier (RFC 1, ARPANET). PDFHorse-traditie was om Adobe-genen aan te houden; hier wijken we af om de output-fase te markeren als "het naar buiten brengen van data" — Crocker maakte dat in 1969 mogelijk.

---

## [v0.4.0-Taft] — 2026-06-04

### Added
- **Sign-feature** — drie modi:
  - **Modus A**: bitmap upload (PNG/JPG, max 10 MB)
  - **Modus B**: SVG upload (max 2 MB, `<script>` gestript voor XSS-defense, rasterized naar PNG via canvas)
  - **Modus C**: live tekenen via signature_pad 5.0.4 + automatische wit→transparant conversie van de stroke-achtergrond
- Klik-plaatsing op PDF-page via PDF.js preview (hergebruikt van fill)
- Breedte-slider voor handtekening-grootte; hoogte volgt automatisch image-aspect-ratio
- Multiple placements per PDF mogelijk; ✕ verwijdert individuele plaatsing
- `pdf-lib` `embedPng` / `embedJpg` + `drawImage` met canvas→PDF coords-transform

### Changed
- `frontend/index.html` header → v0.4.0 — Taft
- `version.json` → 0.4.0 / Taft / fourth-feature
- `docs/DEPENDENCIES.md`: signature_pad 5.0.4 actief, Fabric.js geschrapt (overbodig)
- `ARCHITECTURE.md` sign-flow geactualiseerd met 3 modi + transform-formules

### Codename
**Bill Taft** — Adobe engineer, mede-ontwerper PostScript Level 2 (1991) en PDF-architectuur-evolutie.

---

## [v0.3.0-Putman] — 2026-06-04

### Added
- **Fill-feature** (client-only) — PDF.js render preview van alle pages + klik-overlay om tekstvelden te plaatsen + pdf-lib `drawText` op exacte coördinaten + download invulde PDF
- `docs/PRINCIPLES.md` — 8 ontwerpprincipes P1 t/m P8 met *waarom* en conflict-tests
- `docs/PRIVACY.md` — volledige privacyverklaring (was eerder alleen aankondiging in README)
- `docs/BUGLIST.md` — skelet uit `Meta_Master/templates/BUGLIST_TEMPLATE.md`
- `CHANGELOG.md` — dit bestand

### Changed
- `frontend/index.html` header → v0.3.0 — Putman
- `version.json` → 0.3.0 / Putman / third-feature
- PDF.js 4.x toegevoegd via CDN (cdnjs cloudflare)

### Codename
**Ivan E. Sutherland** (PDF-pioniers thema heeft alleen 7 Adobe-pioniers; voor v0.3.x kies ik Robert M. Putman, een van de architecten van PostScript-grafische primitieven). Brotz blijft gereserveerd voor v1.0.0.

---

## [v0.2.0-Wozencraft] — 2026-06-04

### Added
- **Split-feature** (client-only) — range-syntax `1-3, 5, 8-10` → N losse output-PDFs
- Drop-zone + file-input voor 1 PDF, live page-count tonen
- Range-input met live-validatie (regex `/^[\d,\s-]+$/`, bounds 1..pageCount, geen achteruit-bereiken)
- Visuele lijst van geparste ranges vóór splitsen
- 200ms delay tussen sequentiële downloads (popup-blocker mitigation)
- Filename-conventie: `<basename>_pages_X-Y.pdf` of `<basename>_page_N.pdf`
- Encrypted-PDF detect met expliciete foutmelding

### Changed
- `frontend/index.html` header → v0.2.0 — Wozencraft
- `ACTIONS.md` sectie hernoemd v0.2.0 → v0.3.0
- `ARCHITECTURE.md` split-flow geactualiseerd ("geïmplementeerd in v0.2.0-Wozencraft")
- `docs/DEPENDENCIES.md` pdf-lib status uitgebreid (merge + split)

### Tests
- pytest 4/4 groen (backend ongewijzigd)
- Node smoke: 10-page PDF + ranges `1-3, 5, 8-10` → 3 PDFs van 3/1/3 pages ✓

### Codename
**Lawrence M. Wozencraft** — PostScript engineer Adobe, mede-ontwerper van het PostScript drawing model.

---

## [v0.1.0-Geschke] — 2026-06-04

### Added
- **Merge-feature** (client-only) — meerdere PDFs slepen/uploaden, drag-to-reorder via ↑/↓-knoppen, ✕ voor verwijderen, `Samenvoegen` → `merged.pdf` download
- pdf-lib 1.17.1 via unpkg CDN
- Size-limits 50 MB/file, 100 MB/sessie (client-side enforced)
- Encrypted-PDF detect met expliciete foutmelding
- `docs/DESIGN_TOKENS.md` — kleuren/typografie/spacing/states/accessibility-tokens
- `docs/DEPENDENCIES.md` — frontend + backend deps + impact-matrix

### Changed
- README.md herschreven naar v0.1.0-Geschke + statuskolom per functie
- `ACTIONS.md` merge afgevinkt
- `ARCHITECTURE.md` merge-flow geactualiseerd

### Codename
**Charles M. Geschke** — mede-oprichter Adobe Systems (1982) samen met John Warnock.

---

## [v0.0.2-Warnock] — 2026-06-04

### Added
- FastAPI backend skelet: `/api/health` + `/api/limits` live; `/api/ocr` + `/api/mail` 501-stubs
- Alpine.js + Tailwind frontend met 5 tabs (Merge, Split, Invullen, Ondertekenen, OCR)
- Deploy-artefacten: `deploy/nginx-pdfhorse.conf` + `deploy/pdfhorse.service` + `deploy/README.md`
- pytest infrastructure (4/4 tests groen op `/api/health` + `/api/limits`)
- CORS + lifespan-manager voor tijdelijke `/tmp/pdfhorse/` directory

### Codename
**John E. Warnock** (skelet-fase) — mede-uitvinder PostScript (1982) en PDF (1993), mede-oprichter Adobe.

---

## [v0.0.1-Warnock] — 2026-06-03

### Added
- Initiële repository met `LICENSE` (AGPL-3.0), `README.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `ACTIONS.md`, `version.json`, `.gitignore`, `.env.example`
- Newp-sessie documentatie (`prompts/2026-06-03_newp_pdfhorse.md`)
- Geen runnable code — alleen ontwerp + ecosysteem-vastlegging
- Klassificatie als **iCt Horse tooling SaaS** (niet onder Meta_iCt_Horse_Diensten — voldoet niet aan S1: geen klant-sessies, auth of persistente data)

### Codename
**John E. Warnock** (init) — zelfde codenaam als v0.0.2 want skelet-traject; oranje bump komt in v0.1.0.
