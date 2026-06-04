# ARCHITECTURE — PDFHorse

> Hybride client/server PDF-bewerker. Zoveel mogelijk client-side (privacy); server alleen waar onvermijdelijk (OCR, mail).

## Componenten

### Frontend (browser, served via icthorse.nl/PDFHorse/)

| Component | Verantwoordelijkheid | Library |
|---|---|---|
| `app.js` | App-bootstrap, routing tussen functies, sessie-state | Alpine.js |
| `pdf_loader.js` | PDF inlezen/parsen, page-thumbnails renderen | pdf-lib + PDF.js |
| `merge.js` | Meerdere PDF's samenvoegen, paginavolgorde wijzigen (drag/drop) | pdf-lib |
| `split.js` | PDF opdelen op page-ranges, output meerdere PDF's | pdf-lib |
| `fill.js` | Tekstvelden op pages plaatsen (free-form overlay) | pdf-lib + canvas |
| `sign.js` | Handtekening invoegen — 3 modi (bitmap-upload, SVG-upload, live-canvas) | signature_pad + Fabric.js + pdf-lib |
| `output.js` | Download/print, of POST naar `/api/mail` | native browser API + fetch |
| `ocr_client.js` | Upload PDF naar `/api/ocr`, poll status, download resultaat | fetch |
| `ui/*` | Layout, Tailwind components | Tailwind 3.x (via CDN, geen build) |

### Backend (Python 3.12 + FastAPI, HC55 `:3963`)

| Endpoint | Doel | Verwerking |
|---|---|---|
| `GET /api/health` | Healthcheck | Statisch |
| `POST /api/ocr` | OCR uitvoeren op upload | Multipart in → tijdelijke `/tmp/pdfhorse/<uuid>/in.pdf` → `ocrmypdf` (Tesseract `nld+eng`) → `/tmp/.../out.pdf` → return → unlink dir |
| `POST /api/mail` | Mail uitgaande PDF | Multipart in (PDF + recipient + subject) → SMTP via `pdfservice@icthorse.nl` → return status → unlink upload |
| `GET /api/limits` | Limieten terug | Statisch JSON |

### Externe systemen

| Systeem | Rol |
|---|---|
| Hostinger SMTP | Verzendt mail als `pdfservice@icthorse.nl` |
| HC55 nginx | Reverse-proxy `/PDFHorse/` → `:3963` |
| icthorse.nl (Hostinger) | Levert statisch frontend (HTML/JS/CSS) via PHP-include of static-mount |

## Relaties met andere repos

| Repo | Relatie |
|---|---|
| `iCt_Horse` | Frontend-shell levert nginx-config + branding/theme; PDFHorse haakt aan op `icthorse.nl/PDFHorse/` |
| `Meta_iCt_Horse` | Parent master (iCt Horse ecosysteem) — PDFHorse staat **direct** hieronder als tooling SaaS |
| `Meta_Master` | Global registry (PROJECTS.json/STATUS.md/ECOSYSTEMS.md) |
| `SVGEditor` | Zuster-tooling (zelfde ecosysteem-niveau); both one-shot SaaS |
| `FreeSaasArchimate` | Zuster-tooling (zelfde ecosysteem-niveau) |
| `HorseSafe` | Zuster-dienst (sub-ecosysteem Diensten); nginx-conventie `/HorseSafe/` is template voor `/PDFHorse/` |
| `CloudInfra` | Beheer Hetzner; PDFHorse poort 3963 geregistreerd in `SHARED_INFRASTRUCTURE.md` |

## Data-flow per functie

### Merge (client-only) — geïmplementeerd in v0.1.0-Geschke
```
Browser ← user-upload PDFs (drag-drop of file-input)
    │
    ▼ client-side validatie: type=PDF, size ≤ 50MB, totaal ≤ 100MB
    │  drag-to-reorder met ↑/↓-knoppen
    ▼
pdf-lib.PDFDocument.load() per file (ignoreEncryption: false)
    │  → bij encrypted PDF: foutmelding, geen merge
    ▼
mergedPdf.copyPages() + addPage() per page-index
    │
    ▼
Download Blob (mergedPdf.save()) → merged.pdf
    │
    ▼ URL.revokeObjectURL() na 1s (geheugen vrij)
```
Geen netwerk-call. Library `pdf-lib@1.17.1` via CDN (`unpkg.com`).

### Split (client-only) — geïmplementeerd in v0.2.0-Wozencraft
```
Browser ← user-upload 1 PDF (drag-drop of file-input)
    │
    ▼ client-side validatie: type=PDF, size ≤ 50MB
    │  pdf-lib load + getPageCount() → toon "<naam> — <bytes> — <N> pagina's"
    ▼
User-input range-string "1-3, 5, 8-10"
    │
    ▼ parseSplitRanges(): regex /^[\d,\s-]+$/ + per part /^(\d+)(?:-(\d+))?$/
    │  bounds-check 1..pageCount, geen achteruit-bereiken
    │  live-feedback: per range "pagina X-Y (N pagina's)"
    ▼
runSplit(): per range nieuw PDFDocument + copyPages(src, [pages-1])
    │
    ▼ download Blob → "<basename>_pages_X-Y.pdf" of "<basename>_page_N.pdf"
    │  200ms delay tussen downloads (popup-blocker mitigation)
    ▼
URL.revokeObjectURL() na 1s per download
```
Geen netwerk-call. Geen ZIP (vermijdt JSZip-dep; mogelijk in v0.2.x).

### OCR (client → server → client)
```
Browser ← upload PDF
    │
    ▼ POST /api/ocr (multipart)
HC55:3963 → /tmp/pdfhorse/<uuid>/in.pdf
    │
    ▼ ocrmypdf --language nld+eng
/tmp/pdfhorse/<uuid>/out.pdf
    │
    ▼ stream response
Browser → download searchable PDF
    │
    ▼ (server) shutil.rmtree(<uuid>)
```
Server houdt **niets** vast.

### Sign (client-only, 3 modi)
```
Modus A: bitmap-upload → PIL-achtige client-resize → Fabric.js layer → pdf-lib embed
Modus B: SVG-upload → SVG → PNG via canvas → embed
Modus C: live-tekenen → signature_pad → dataURL → embed
```
Geen netwerk-call (tot output-stap).

### Fill (client-only) — geïmplementeerd in v0.3.0-Putman
```
Browser ← user-upload 1 PDF
    │
    ▼ pdf-lib PDFDocument.load → pageCount
    │  PDF.js getDocument → per page render in <canvas>
    ▼
User klikt op pagina-canvas → addFillField()
    │  → tekstveld op (x,y) canvas-coords, met fontSize
    │  → Alpine.js reactive list, ✕ knop voor verwijder
    ▼
runFill():
    pdf-lib PDFDocument.load
    embedFont(Helvetica)
    per veld: canvas (x,y, top-left origin) → PDF (x, height-y, bottom-left origin)
              scale = pdfSize / canvasSize per page
              page.drawText(text, { x, y, size, font })
    pdfDoc.save → Blob → "<basename>_filled.pdf" download
```
Geen netwerk-call. Libs: pdf-lib 1.17.1 + PDF.js 4.0.379 (cdnjs).

### Mail-output (client → server)
```
Browser ← edited PDF + recipient + subject
    │
    ▼ POST /api/mail (multipart)
HC55:3963 → smtplib.SMTP_SSL('smtp.hostinger.com')
    │
    ▼
recipient@... ← mail van pdfservice@icthorse.nl + PDF attached
    │
    ▼
(server) unlink tijdelijke PDF
```

## Sessie-state

- Geen server-side sessie-state (stateless API).
- Client houdt PDF + edit-state in `window` / IndexedDB (alleen tijdens sessie).
- Geen cookies (anoniem).
- Geen analytics (privacy-default).

## Limieten (gehard in code)

- `MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024`
- `MAX_SESSION_TOTAL_BYTES = 100 * 1024 * 1024`
- `SESSION_TIMEOUT_S = 30 * 60`
- OCR-cleanup-job (cron of FastAPI BackgroundTask): elke 5 min `find /tmp/pdfhorse -mmin +30 -delete`

## Beveiliging

- HTTPS-only (nginx redirect).
- Rate-limiting op `/api/ocr` en `/api/mail` (slowapi).
- `/api/mail` voorkomt open-relay: subject + body server-controlled, recipient gevalideerd via regex + DNS-MX-check optioneel.
- CORS strict op `icthorse.nl`.
- Geen file-execution; PDF-input wordt door pdf-lib / ocrmypdf gevalideerd.
- CSP-header beperkt scripts tot self + Tailwind/pdf-lib CDN.

## Deployment

- Python venv op HC55, `uvicorn` achter `systemd` unit `pdfhorse.service`.
- nginx `location /PDFHorse/api/` → `proxy_pass http://127.0.0.1:3963/api/`.
- nginx `location /PDFHorse/` → static root naar `/var/www/pdfhorse/` (frontend bundle gerysynced bij deploy).
- `.env` op HC55 met SMTP-creds (mode 600, root-only).

## Open architectuur-vragen

| # | Vraag | Default-keuze |
|---|---|---|
| OPEN-1 | Frontend gehost op HC55 of Hostinger? | HC55 (eenvoudiger CORS, één deploy) |
| OPEN-2 | OCR via `ocrmypdf` (wrapper) of direct `pytesseract` + reportlab? | `ocrmypdf` (battle-tested, behoudt PDF-structuur) |
| OPEN-3 | Bestands-upload via fetch of WebTransport/chunked? | fetch (50MB-limit is OK voor multipart) |
| OPEN-4 | Live-handtekening: signature_pad of native canvas? | signature_pad (smoothing + pen-pressure) |
| OPEN-5 | Print: browser-print of PDF.js print-viewer? | Browser-print op een hidden iframe met de PDF |
| OPEN-6 | Mail: alleen aan opgegeven adres, of ook BCC-self optie? | Alleen opgegeven adres (geen archief = privacy) |
