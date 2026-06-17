# Changelog — PDFHorse

> Versie-historie. Formaat: [Keep a Changelog](https://keepachangelog.com/) op hoofdlijnen, met PDFHorse-eigen codenamen (thema: PDF-pioniers).
> Bijgewerkt bij elke release. Datums = release naar `main`.

## [v0.11.0-Rahtz] — 2026-06-17

> Codenaam **Sebastian Rahtz** — `hyperref`/PDF-integratie in LaTeX. PDF-pioniers/LaTeX-lijn na Thanh. `Brotz` blijft gereserveerd voor v1.0.0.

### Added — Ondertekenen: getekende handtekening exporteren
- In **modus C (live tekenen)** kun je de getekende handtekening nu downloaden als bestand voor hergebruik:
  - **PNG** — transparante achtergrond (bijna-witte pixels → alpha 0) via `_whiteToTransparentDataUrl`.
  - **SVG** — echte vector via signature_pad `toDataURL('image/svg+xml')`.
- Nieuwe methodes `exportSignPng()`, `exportSignSvg()` + helper `_downloadDataUrl()`. Twee knoppen "⬇ PNG" / "⬇ SVG" in het modus-C-blok, met lege-pad-check.

### Changed
- `index.html`: export-knoppen + toelichting in modus C; header → v0.11.0 — Rahtz.
- `version.json` → 0.11.0 / Rahtz / 2026-06-17.

### Notes
- **Client-only** — geen backend-/dependency-wijziging. Deploy = rsync frontend + `systemctl restart pdfhorse`.

## [v0.10.0-Thanh] — 2026-06-17

> Codenaam **Hàn Thế Thành** — uitvinder van pdfTeX (directe PDF-generatie uit TeX). Past in PDF-pioniers/LaTeX-lijn na Knuth/Reid/Lamport/Mittelbach. `Brotz` blijft gereserveerd voor v1.0.0.

### Added — Ondertekenen: verplaatsbare handtekening
- Een **geplaatste** handtekening is nu **versleepbaar** naar de juiste positie (`startSignDrag`). Pointer-events dekken muis, touch én pen. Positie wordt geklemd binnen de pagina-canvas; de canvas-rect wordt per beweging opnieuw gemeten zodat scrollen tijdens het slepen niet verschuift. Plaatsen-via-klik en ✕-verwijderen blijven werken.
- Hint-tekst + `cursor-move`/`touch-none` op de handtekening-overlay.

### Added — Fill → Sign overdracht
- Na **Invullen** wordt de ingevulde PDF beschikbaar gemaakt voor **Ondertekenen** (`signHandoff`-state). Bij wisselen naar de Ondertekenen-tab (terwijl er nog geen sign-bestand geladen is) wordt die PDF **automatisch** overgenomen; daarnaast een expliciete knop **"→ Onderteken deze PDF"** in de Invullen-tab.
- Zo kun je een formulier invullen én ondertekenen zonder tussentijds downloaden + opnieuw uploaden.

### Changed
- `app.js`: nieuwe state `signHandoff`; nieuwe methodes `goTab()`, `continueToSign()`, `startSignDrag()`. `_signLoad` opgesplitst in `_signLoad` (uploadpad) + `_signLoadBytes` (laden uit geheugen) — DRY render-logica. `runFill` zet de overdracht klaar.
- `index.html`: tab-knoppen via `goTab(t.id)`; handtekening-overlay versleepbaar; knop in Invullen-tab; header → v0.10.0 — Thanh.
- `version.json` → 0.10.0 / Thanh / 2026-06-17.

### Notes
- **Client-only** — geen backend-, endpoint- of dependency-wijziging. Backend leest versie bij import, dus deploy = `git pull` + rsync frontend + `systemctl restart pdfhorse`.

## [v0.9.1-Mittelbach] — 2026-06-14

### Added — Security-hardening (SRI)
- **Subresource Integrity** op 4 CDN-scripts via SHA-384 + `crossorigin="anonymous"` + `referrerpolicy="no-referrer"`:
  - `pdf-lib@1.17.1`
  - `pdf.js@4.0.379` (hoofdmodule)
  - `signature_pad@5.0.4`
  - `alpinejs@3.14.1` (gepind, was floating `3.x.x` — SRI vereist exacte versie)
- Tailwind Play CDN (`cdn.tailwindcss.com`) uitgezonderd: dynamic per-request build, payload-hash niet stabiel. CSP en Hostinger-HTTPS fungeren als guard. Gedocumenteerd in `index.html`-comment + `PRIVACY.md`.
- PDF.js worker (`pdf.worker.min.mjs`) ook ongehard (kan niet via `GlobalWorkerOptions`); minimaal risico want zelfde origin als hoofdmodule.

### Added — Format-uitbreiding Convert-tab
- **`POST /api/convert/odt-to-pdf`** — `.odt` (OpenDocument Text) → PDF via bestaande `_office_to_pdf` helper (LibreOffice Writer kan dit native).
- **`POST /api/convert/rtf-to-pdf`** — `.rtf` → PDF via dezelfde helper (LibreOffice import-filter).
- Frontend Convert-tab accepteert `.odt` + `.rtf`; kleur-badges indigo (ODT) en rose (RTF); 20 MB-limiet zoals docx/xlsx.
- `_officeToPdf` route nu generiek: `/api/convert/${kind}-to-pdf` voor 4 office-types.

### Changed
- `version.json` → 0.9.1 / Mittelbach / 2026-06-14.
- `frontend/index.html` header → v0.9.1 — Mittelbach.
- `app.js`: `ODT_MIME` + `RTF_MIME` constants; `_convertDetectKind`, limit-check en filename-regex uitgebreid.
- Convert-tab intro-tekst en accept-attribuut bijgewerkt.

### Tests
- pytest 20/20 groen — 3 nieuwe (415 odt, 415 rtf, 503 odt-zonder-soffice).

### Codename
**Frank Mittelbach** — LaTeX3-team-lead sinds 1990, document-typesetting kwaliteit + format-engineering. Past bij security-hardening (kwaliteits-borging) + format-uitbreiding. Brotz blijft v1.0.0 reserve.

---

## [v0.9.0-Lamport] — 2026-06-14

### Added
- **Mail-endpoint werkend** — `POST /api/mail` vervangt 501-stub door echte SMTP via Hostinger.
- **Hostinger SMTP hergebruik** (Facturatie-stijl): `SMTP_USER=info@icthorse.nl` (bestaande mailbox), `MAIL_FROM=PDFHorse <info@icthorse.nl>` (display-name vrij, adres = auth-mailbox), `MAIL_REPLY_TO=info@icthorse.nl`. **Geen nieuwe Hostinger-mailbox-actie**.
- **PDF-attachment-validatie**: `.pdf`-extensie + `%PDF-`-header check.
- **In-process rate-limit** 5/uur/IP (Heeres-conventie); thread-safe deque per IP.
- `backend/.env.example` — alle `SMTP_*` / `MAIL_*`-vars met inline-uitleg.
- Frontend: 429-pad in `mailLast()` ("Mail-limiet bereikt").

### Changed
- `frontend/index.html` header → v0.9.0 — Lamport.
- `version.json` → 0.9.0 / Lamport / 2026-06-14.
- Stale stub-bericht in `mailLast()` ("wacht op Hostinger mailbox") verwijderd.

### Decided (RCA-relevant)
- **Slowapi-decorator niet gebruikt** ondanks aanwezigheid in `requirements.txt`. Reden: Python 3.14 + FastAPI + `from __future__ import annotations` + slowapi-wrapper geeft `ForwardRef`-fout op `UploadFile` / `Annotated[str, Form()]`-parameters. In-process bucket is voldoende voor low-volume mail-endpoint (state-loss bij restart acceptabel). Slowapi blijft als dep voor evt. toekomstige middleware-mode.
- **From-adres = SMTP_USER** (`info@icthorse.nl`), display-name `PDFHorse`. Aanvankelijk gepoogd met `pdfservice@icthorse.nl` als pure alias, maar e2e-smoke 2026-06-14 leverde `SMTPRecipientsRefused` op een geldig Gmail-adres → Hostinger weigert from ≠ auth zelfs binnen domein. Facturatie's `DEFAULT_FROM_EMAIL="iCt Horse Facturatie <info@icthorse.nl>"` was achteraf het juiste precedent (niet `facturen@icthorse.nl` zoals ik in de services.py-code las — dat is de waarde van `Company.email_from` voor reply-to, niet het envelope-from).

### Tests
- pytest 17/17 groen — 7 nieuwe mail-tests (400 bad email, 415 non-pdf + 415 zonder `%PDF-`-header, 400 leeg, 503 zonder SMTP-creds, 429 rate-limit, 200 happy path met monkeypatched `_send_via_smtp`).
- Nieuwe `conftest.py` autouse-fixture reset rate-limit-bucket per test (TestClient = één IP).

### HC55 deploy (LIVE 2026-06-14)
- `apt`/pip: geen extra deps.
- `/opt/pdfhorse/.env`: SMTP-blok geappend, `SMTP_PASSWORD` gekopieerd uit `EMAIL_HOST_PASSWORD` in `/opt/facturatie/.env`.
- Frontend gerysynced (`/var/www/pdfhorse/frontend/` → header v0.9.0 — Lamport).
- `systemctl restart pdfhorse` → active; `curl /api/health` → `0.9.0/Lamport`.
- E2E smoke: POST `/api/mail` met 559-byte test-PDF naar `cglebbeek@gmail.com` → HTTP 200 in 0.92s → mail aangekomen met From=`PDFHorse <info@icthorse.nl>` + PDF-attachment.

### Codename
**Leslie Lamport** — LaTeX-pionier (1984), document-typesetting + distributie. Past bij mail-fase (document-output naar derden). Brotz blijft v1.0.0 reserve.

---

## [v0.8.0-Reid] — 2026-06-05

### Added
- **OCR-tab werkend** — gescande PDF → doorzoekbare PDF via `ocrmypdf` + Tesseract (NL + EN)
- **Backend endpoint `POST /api/ocr`** (was 501-stub) — accepteert multipart PDF, draait `ocrmypdf --language nld+eng --skip-text --output-type pdf --quiet`, retourneert `<basename>_ocr.pdf`, BackgroundTask cleanup
- `--skip-text` flag: idempotent op pagina's die al tekst hebben
- Frontend OCR-tab: drop-zone + Verwerken-knop + progress "Bezig… (kan 30s–3min duren)"
- Output-bar krijgt OCR-resultaat
- HTTP-codes: 415 (non-PDF), 400 (leeg), 413 (>50MB), 502 (ocrmypdf-fout), 503 (ocrmypdf ontbreekt), 504 (timeout 180s)

### Changed
- `frontend/index.html` header → v0.8.0 — Reid
- `version.json` → 0.8.0 / Reid
- `backend/requirements.txt`: `ocrmypdf==16.5.0` uncomment + actief
- `backend/main.py`: `MAX_OCR_BYTES=50MB`, `OCRMYPDF_BIN` env, `OCR_LANGUAGES=nld+eng`, `OCR_TIMEOUT_S=180s`

### Tests
- pytest 11/11 groen — 3 nieuwe OCR-tests (415/400/503)

### HC55 deps
- `apt install tesseract-ocr tesseract-ocr-nld tesseract-ocr-eng ghostscript unpaper qpdf` (~250MB)
- `ocrmypdf` via pip in venv

### Codename
**Brian Reid** — auteur van Scribe markup-systeem (1980), document-typografie-pionier. Past bij OCR-fase (tekst-herkenning + structuur). Brotz blijft v1.0.0 reserve.

---

## [v0.7.0-Knuth] — 2026-06-05

### Added
- **Convert-tab** — batch-conversie van `.docx` / `.xlsx` / `.png` / `.jpg` naar PDF
- **Toggle "Combineer alle tot 1 PDF"** — als aan: alle conversies samengevoegd in opgegeven volgorde tot één PDF
- **Backend endpoint `POST /api/convert/xlsx-to-pdf`** (analoog aan docx) via gedeelde helper `_office_to_pdf(file, ext, mime, max_bytes)` (DRY-refactor)
- **Client-side image → PDF** via pdf-lib `embedPng`/`embedJpg` op A4-page met 36pt margin en fit-to-page aspect-ratio (geen server-call, max 50MB)
- Kleur-badges in file-list: DOCX (blauw), XLSX (emerald), PNG/JPG (amber)
- Progress-tekst per file ("Converteert 2/5: factuur.xlsx")
- Multi-output mode: N losse downloads met 200ms delay (popup-blocker mitigation, zoals split)

### Changed
- `backend/main.py`: `convert_docx_to_pdf` body verplaatst naar `_office_to_pdf` helper; docx-route blijft API-compatibel, nieuwe xlsx-route hergebruikt helper
- `MAX_XLSX_BYTES = 20MB` + `XLSX_MIME` constante
- frontend tab-nav krijgt "Converteren" tussen Ondertekenen en OCR
- header → v0.7.0 — Knuth

### Tests
- pytest 9/9 groen — 2 nieuwe tests xlsx-endpoint (415 op niet-xlsx, 503 zonder soffice)

### HC55 dep
- `apt install libreoffice-calc` (~80MB extra naast `-core` + `-writer` van v0.6.0)

### Codename
**Donald Knuth** — wiskundige + TeX-pionier (1978); typografie-fundament voor digitale documenten. Past bij Convert-fase (typografisch correct overzetten naar PDF). Brotz blijft gereserveerd voor v1.0.0.

---

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
