# DEPENDENCIES — PDFHorse

> Alle runtime-afhankelijkheden + impact-matrix. Update bij elke toegevoegde/verwijderde dep.

## Frontend (browser, via CDN — geen npm-build)

| Lib | Versie | CDN | Doel | Status v0.1.0 | License |
|---|---|---|---|---|---|
| Tailwind CSS | `latest` (CDN runtime) | `cdn.tailwindcss.com` | Utility-CSS | actief | MIT |
| Alpine.js | `3.x.x` | `unpkg.com/alpinejs@3.x.x` | Reactive UI binding | actief | MIT |
| **pdf-lib** | **`1.17.1`** | **`unpkg.com/pdf-lib@1.17.1`** | **PDF read/write (merge/split/fill/sign client-side)** | **actief (v0.1.0 merge + v0.2.0 split + v0.3.0 fill)** | **MIT** |
| **PDF.js** | **`4.0.379`** | **`cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/`** | **Page-rendering naar canvas (fill-preview)** | **actief (v0.3.0)** | **Apache-2.0** |
| **signature_pad** | **`5.0.4`** | **`unpkg.com/signature_pad@5.0.4`** | **Live handtekening canvas (sign-modus C)** | **actief (v0.4.0)** | **MIT** |
| Fabric.js | — | — | Niet meer nodig — pdf-lib `drawImage` doet de embed direct | geschrapt (v0.4.0) | MIT |

### Frontend-keuzes

- **Geen build-step / geen npm.** CDN-only houdt repo licht, deploy = `rsync frontend/ → /var/www/pdfhorse/`.
- **Geen SRI-hashes (yet).** Verbeterpunt voor v0.2.x — `integrity=` toevoegen aan alle CDN-scripts. Voor nu vertrouwen we unpkg + HTTPS.
- **CSP komt later** (`docs/SECURITY.md` v0.2.x): scripts gewhitelist op self + `cdn.tailwindcss.com` + `unpkg.com`.

## Backend (Python 3.12, FastAPI)

| Lib | Versie | Doel | Status |
|---|---|---|---|
| FastAPI | latest (pip) | HTTP framework | actief |
| uvicorn | latest | ASGI server | actief |
| python-multipart | latest | file-upload parsing | actief (stub) |
| **ocrmypdf** | **`16.5.0`** | **OCR-wrapper (Tesseract) — `/api/ocr` endpoint** | **actief (v0.8.0)** |
| **Tesseract 5 (system)** | **OS-level** | **OCR-engine + `nld+eng` taalpacks + ghostscript + unpaper + qpdf** | **actief op HC55 (v0.8.0)** |
| **LibreOffice (`libreoffice-core` + `libreoffice-writer` + `libreoffice-calc`)** | **OS-level** | **`soffice --headless` voor `.docx` (v0.6.0) en `.xlsx` (v0.7.0) → PDF** | **actief op HC55** |
| **smtplib (stdlib)** | **3.12+** | **Hostinger SMTP (`smtp.hostinger.com:587` STARTTLS) — `/api/mail`** | **actief (v0.9.0)** |
| **email.message (stdlib)** | **3.12+** | **MIME-multipart message-building voor mail-attachment** | **actief (v0.9.0)** |
| slowapi | 0.1.9 | Geïnstalleerd; **niet gebruikt op `/api/mail`** wegens ForwardRef-conflict Python 3.14+FastAPI+`Annotated`. Vervangen door in-process `collections.deque`-bucket per IP (zie `_rate_limit_check` in `backend/main.py`). Blijft als dep voor toekomstige middleware-mode of OCR-throttling. | partial |
| pytest | 8.3.3 | Tests | actief (17/17 groen) |

## Externe systemen

| Systeem | Rol | Status |
|---|---|---|
| HC55 (Hetzner) | Backend host poort 3963 + frontend static | klaar voor deploy |
| HC55 nginx | Reverse-proxy `/PDFHorse/api/` → `:3963` + static `/PDFHorse/` | snippet klaar in `deploy/nginx-pdfhorse.conf` |
| Hostinger SMTP | Uitgaande mail — auth via bestaande `info@icthorse.nl`-mailbox (hergebruik van Facturatie); from=`pdfservice@icthorse.nl` alias zonder eigen mailbox | **actief sinds v0.9.0-Lamport** |
| icthorse.nl frontend-shell | Branding + footer-link `/PDFHorse/` | cross-repo actie `iCt_Horse` |

## Impact-matrix (welke component breekt als dep wegvalt?)

| Dep weg | Impact | Mitigatie |
|---|---|---|
| pdf-lib CDN down | Merge/split/sign/fill onmogelijk | Future: self-host onder `/PDFHorse/vendor/pdf-lib.min.js` |
| unpkg.com down (algemeen) | Alpine + pdf-lib geblokkeerd | Future: alle vendor self-hosten |
| Tailwind CDN down | Layout breekt (geen styling) | Future: prebuild `styles.css` met `tailwindcss` CLI |
| Hostinger SMTP down | Mail-output faalt; download/print blijven werken | OCR + merge + sign blijven werken |
| HC55 backend down | OCR + mail down; **merge/split/sign/fill blijven werken** (frontend kan stand-alone op Hostinger) | Privacy-bonus: alleen client-side features blijven beschikbaar |
| Tesseract taalpack `nld` ontbreekt | OCR faalt op NL-PDFs | install-check in `deploy/README.md` |

## Versiehistorie

| Versie | Wijziging |
|---|---|
| v0.0.2-Warnock | Tailwind + Alpine CDN, FastAPI + uvicorn |
| v0.1.0-Geschke | **+ pdf-lib 1.17.1** (CDN) voor client-side merge |
| v0.2.0-Wozencraft | Geen nieuwe deps — split hergebruikt pdf-lib 1.17.1 |
| v0.3.0-Putman | **+ PDF.js 4.0.379** (CDN cdnjs) voor fill-preview canvas-render |
| v0.4.0-Taft | **+ signature_pad 5.0.4** (CDN unpkg) voor live-tekenen modus C; Fabric.js *geschrapt* (overbodig) |
| v0.5.0-Crocker | Geen nieuwe deps — output-bar is pure JS + bestaande fetch |
| v0.6.0-Paxton | **+ LibreOffice (`libreoffice-core` + `libreoffice-writer`)** als OS-level backend-dep voor docx→PDF conversie via `soffice --headless` |
| v0.7.0-Knuth | **+ `libreoffice-calc`** voor xlsx→PDF. Geen nieuwe frontend-deps — image→PDF gebruikt bestaande pdf-lib `embedPng`/`embedJpg` |
| v0.8.0-Reid | **+ `ocrmypdf` 16.5.0 (pip) + Tesseract (apt) + tesseract-ocr-nld/eng + ghostscript + unpaper + qpdf** voor `/api/ocr` endpoint |
