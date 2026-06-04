# Changelog — PDFHorse

> Versie-historie. Formaat: [Keep a Changelog](https://keepachangelog.com/) op hoofdlijnen, met PDFHorse-eigen codenamen (thema: PDF-pioniers).
> Bijgewerkt bij elke release. Datums = release naar `main`.

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
