# ACTIONS — PDFHorse

> Openstaande acties voor PDFHorse. Bovenste blok = werk-in-uitvoering. Onderste = backlog. Afgeronde acties → `ACTIONS_DONE.md` na 30d.

## Nu (v0.0.2 → v0.0.3)

- [x] **OPEN-architectuur:** 6 vragen beantwoord met defaults (HC55-frontend / ocrmypdf / fetch / signature_pad / browser-print / geen BCC) (04-06)
- [ ] **Hostinger:** mailbox `pdfservice@icthorse.nl` aanmaken + SMTP-creds noteren in `.env` op HC55 — **gebruikersactie**
- [x] **SHARED_INFRASTRUCTURE.md** uitgebreid met PDFHorse :3963 (04-06)
- [x] **Frontend skelet:** `frontend/index.html` + Alpine+Tailwind CDN + 5 tabs + health/limits-aanroep + footer (04-06)
- [x] **Backend skelet:** FastAPI `/api/health` + `/api/limits` + stubs `/api/ocr` + `/api/mail` (501) + CORS + lifespan tmp-dir (04-06)
- [x] **4/4 pytest tests groen** + live smoke-test op alt-port (04-06)
- [x] **Deploy artefacten:** `deploy/nginx-pdfhorse.conf` + `deploy/pdfhorse.service` + `deploy/README.md` (04-06)
- [ ] **HC55 deploy:** install per `deploy/README.md` — wacht op mailbox-creds
- [ ] **nginx-config op HC55:** snippet inhaken in main server-block + reload (gebruikersactie of na deploy)

## Volgende (v0.1.0-Geschke → v0.2.0)

- [x] **Merge-functie werkend** (pdf-lib via CDN, client-only, drag-to-reorder, size-limits, encrypted-PDF detect) (04-06, v0.1.0-Geschke)
- [ ] Split-functie werkend
- [ ] Sign-modus C (live-canvas) — signature_pad
- [ ] Sign-modus A (bitmap upload) + B (SVG upload)
- [ ] Fill-functie (free-form tekst overlay)
- [ ] OCR-endpoint (ocrmypdf + Tesseract nld+eng) op HC55
- [ ] Mail-endpoint (SMTP Hostinger)
- [ ] Cleanup-job `/tmp/pdfhorse/` (30 min)
- [ ] Rate-limiting (slowapi)
- [ ] CSP + CORS-strict
- [ ] `docs/PRIVACY.md`
- [ ] `docs/DESIGN_TOKENS.md`
- [ ] `docs/DEPENDENCIES.md`

## Later (v1.0.0-Brotz)

- [ ] PDF/A-3 export
- [ ] Echte AcroForm-fields (in plaats van overlay)
- [ ] Multi-language UI (NL/EN)
- [ ] PWA / offline-mode voor merge/split/sign (Service Worker)
- [ ] PAdES digitale handtekening (X.509) — apart traject, niet MVP

## Cross-repo

- [ ] **iCt_Horse:** nginx-config `/PDFHorse/` toevoegen + branding/footer-link
- [x] **Meta_Master:** entry in PROJECTS.json ecosysteem "iCt Horse" + ECOSYSTEMS.md + STATUS.md (04-06)
- [ ] **Meta_iCt_Horse_Diensten:** GEEN entry — PDFHorse is tooling, géén dienst
- [ ] **CloudInfra:** poort 3963 + systemd-unit registreren
