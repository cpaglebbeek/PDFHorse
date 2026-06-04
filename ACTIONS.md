# ACTIONS — PDFHorse

> Openstaande acties voor PDFHorse. Bovenste blok = werk-in-uitvoering. Onderste = backlog. Afgeronde acties → `ACTIONS_DONE.md` na 30d.

## Nu (v0.0.1 → v0.0.2)

- [ ] **OPEN-architectuur:** 6 vragen in `ARCHITECTURE.md` beantwoorden (frontend host, OCR-lib, upload-protocol, sig-lib, print-strat, mail-archief) (03-06)
- [ ] **Hostinger:** mailbox `pdfservice@icthorse.nl` aanmaken + SMTP-creds noteren in `.env.example` template (03-06) — **gebruikersactie**
- [ ] **DNS/nginx:** SHARED_INFRASTRUCTURE.md uitbreiden met PDFHorse :3963 + nginx-location `/PDFHorse/` (03-06)
- [ ] **Frontend skelet:** `frontend/index.html` + `frontend/app.js` (Alpine.js + Tailwind CDN) + 5 route-tabs (merge/split/fill/sign/ocr) — v0.0.2 (TBD)
- [ ] **Backend skelet:** `backend/main.py` (FastAPI) + `/api/health` + stubs voor `/api/ocr` en `/api/mail` (TBD)

## Volgende (v0.0.2 → v0.1.0-Geschke)

- [ ] Merge-functie werkend (pdf-lib)
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
