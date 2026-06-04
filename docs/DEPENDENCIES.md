# DEPENDENCIES — PDFHorse

> Alle runtime-afhankelijkheden + impact-matrix. Update bij elke toegevoegde/verwijderde dep.

## Frontend (browser, via CDN — geen npm-build)

| Lib | Versie | CDN | Doel | Status v0.1.0 | License |
|---|---|---|---|---|---|
| Tailwind CSS | `latest` (CDN runtime) | `cdn.tailwindcss.com` | Utility-CSS | actief | MIT |
| Alpine.js | `3.x.x` | `unpkg.com/alpinejs@3.x.x` | Reactive UI binding | actief | MIT |
| **pdf-lib** | **`1.17.1`** | **`unpkg.com/pdf-lib@1.17.1`** | **PDF read/write (merge/split/fill/sign client-side)** | **actief (v0.1.0 merge + v0.2.0 split)** | **MIT** |
| PDF.js | — | `mozilla.github.io/pdf.js` | Page-thumbnails / preview | gepland (split-preview later) | Apache-2.0 |
| signature_pad | — | `unpkg.com/signature_pad` | Live handtekening canvas | gepland (sign-feature) | MIT |
| Fabric.js | — | `unpkg.com/fabric` | Canvas-overlay (sign-modus A/B) | gepland (sign-feature) | MIT |

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
| ocrmypdf | latest | OCR-wrapper (Tesseract) | gepland v0.0.3 |
| Tesseract 5 (system) | OS-level | OCR-engine + `nld+eng` taalpacks | gepland (HC55) |
| smtplib (stdlib) | — | SMTP via Hostinger | gepland v0.0.3 |
| slowapi | latest | Rate-limiting `/api/ocr` + `/api/mail` | gepland |
| pytest | latest | Tests | actief (4/4 groen) |

## Externe systemen

| Systeem | Rol | Status |
|---|---|---|
| HC55 (Hetzner) | Backend host poort 3963 + frontend static | klaar voor deploy |
| HC55 nginx | Reverse-proxy `/PDFHorse/api/` → `:3963` + static `/PDFHorse/` | snippet klaar in `deploy/nginx-pdfhorse.conf` |
| Hostinger SMTP (`pdfservice@icthorse.nl`) | Uitgaande mail | mailbox nog aan te maken (gebruikersactie) |
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
