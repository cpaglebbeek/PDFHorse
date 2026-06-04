---
date: 2026-06-03
repo: PDFHorse
status: open
resume: "verder met PDFHorse v0.0.3 — Hostinger mailbox pdfservice@icthorse.nl aanmaken (gebruikersactie), HC55 deploy per deploy/README.md, eerste werkende feature kiezen (merge of split = client-only, geen mail/OCR-deps) → v0.1.0-Geschke bij eerste groene feature"
---

# Sessie 2026-06-03 — newp PDFHorse v0.0.1-Warnock

**Agent:** Claude Opus 4.7
**Repo:** PDFHorse (cpaglebbeek/PDFHorse, PUBLIC AGPL-3.0)
**Branche:** main
**Cross-repo werk:** Meta_Master (PROJECTS/ECOSYSTEMS/STATUS/RESUME/SHARED_INFRASTRUCTURE), claude_memory (project_pdfhorse.md + MEMORY.md)
**Eindstand commits:** TBD bij OEU

---

## Opdracht (samengevat)

Nieuw project PDFHorse aanmaken: anonieme browser-first PDF-bewerker (merge/split/OCR/invullen/ondertekenen met 3 sig-modi) onder iCt Horse Diensten. Output download/print/mail via `pdfservice@icthorse.nl`. Hosting op HC55 :3963 achter `icthorse.nl/PDFHorse/`. PUBLIC AGPL-3.0. Codenaam-thema PDF-pioniers, v0.0.1-Warnock.

---

## Prompts en acties — chronologisch

### Prompt 1 — "/checkresume"
**Actie:** RESUME.md geregenereerd (131 sessies), volledige tabel getoond.

### Prompt 2 — "toon mij per 10 en gesorteerd op nieuwste"
**Actie:** 131 sessies in 14 batches van 10 getoond.

### Prompt 3 — "verder met pdfhorse"
**Actie:** PDFHorse niet gevonden in PROJECTS.json/memory/disk. WhatIf met 3 interpretaties (A=newp / B=facturatie-deelproject / C=typo) + 10 open vragen Q1-Q10.

### Prompt 4 — "A. newp PDFHorse, doel: PDF-merge/split/OCR; en invulmogelijkheid met handtekening. uploaden als bitmap,svg of ter plekken tekenen. resulaat opslaan als pdf, printen of mailen via pdfservic@icthorse.nl"
**Actie:** Volledige WhatIf voor newp PDFHorse: 4-stap plan + 10 invul-aannames + impactanalyse.
**Keuze:** Voorstel ecosysteem Meta_iCt_Horse_Diensten + PUBLIC AGPL + v0.0.1-Warnock + HC55:3963 + URL icthorse.nl/PDFHorse/ + mailbox pdfservice@icthorse.nl.

### Prompt 6 — "ga door met v0.0.2"
**Actie:** v0.0.2-Warnock skelet gebouwd (groene bump, geen codename-wijziging):
- `backend/main.py` (FastAPI + CORS + lifespan + tmp-dir) + `__init__.py` + `requirements.txt`
- `backend/tests/test_health.py` — 4 tests health/limits/ocr-501/mail-501, alle groen
- `frontend/index.html` (Alpine+Tailwind CDN, 5 tabs: merge/split/fill/sign/ocr) + `js/app.js` (health+limits fetch) + `css/styles.css`
- `deploy/nginx-pdfhorse.conf` (location /PDFHorse/ static + /PDFHorse/api/ proxy met client_max_body_size 55m + access_log off) + `deploy/pdfhorse.service` (systemd hardened) + `deploy/README.md` (HC55 install-stappen)
- Live smoke-test op alt-poort (3964): health 200 + limits 200 + ocr/mail 501 ✓
- `version.json` → v0.0.2 + ACTIONS.md afgevinkt
**Keuze:** Codenaam blijft Warnock (groene mini-bump). v0.1.0-Geschke pas bij eerste werkende feature (merge of split — client-only, geen externe deps).

### Prompt 5 — "verder"
**Actie:** Pre-flight (Meta_iCt_Horse_Diensten ✓ / poort 3963 vrij ✓ / gh auth ✓ / MEMORY.md 32KB → kort houden / repo lokaal nog niet aanwezig). 8-stap-cascade gestart:
- Lokale dir + git init
- AGPL-3.0 LICENSE gedownload
- README.md, CLAUDE.md, ARCHITECTURE.md, .gitignore, version.json, ACTIONS.md, prompts/ aangemaakt
- Meta_iCt_Horse_Diensten PROJECTS.json + ECOSYSTEMS.md + STATUS.md + ACTIONS.md bijgewerkt
- Meta_Master PROJECTS.json + ECOSYSTEMS.md + STATUS.md bijgewerkt
- Memory project_pdfhorse.md + MEMORY.md regel
- gh repo create cpaglebbeek/PDFHorse + push
- update_resume.py + commit-pushes

---

## Belangrijke keuzes deze sessie

| Keuze | Reden |
|---|---|
| Ecosysteem = direct onder Meta_iCt_Horse (tooling SaaS) | One-shot, geen klant-sessies/auth/persistente data → past niet onder Diensten-sub-master S1-criteria. Zusters: SVGEditor, FreeSaasArchimate. Aanvankelijk Diensten voorgesteld in WhatIf — door pre-flight CLAUDE.md-check S1-mismatch betrapt vóór schade. |
| PUBLIC AGPL-3.0 | Iiet patroon: dienst-frontend mag gratis worden gebruikt, fork-as-service triggert source-publicatie |
| Codenamen PDF-pioniers, v0.0.1-Warnock | John Warnock = PDF-uitvinder (PostScript + Adobe mede-oprichter) |
| HC55 :3963 | Eerstvolgende vrije poort na 3962 (Facturatie); SHARED_INFRASTRUCTURE bevestigt geen conflict |
| URL `/PDFHorse/` (camelcase) | Consistent met `/HorseSafe/`, makkelijker te onthouden dan all-lowercase |
| Hybride client/server | Privacy-first: alleen OCR + mail server-side (rest in browser via pdf-lib) |
| Tech-stack Alpine+Tailwind+FastAPI | Lichter dan Django (geen DB nodig), consistent met VeiligDelen/iCtHorseAssist |
| Limieten 50MB/100MB/30min | Tesseract-geheugen + DoS-bescherming + cleanup-window |
| OCR-talen NL+EN | Standaard voor NL-doelgroep |
| Geen account, geen archief | Privacy + complexity-reductie |

---

## Open eindjes na deze sessie

**Wacht op gebruikersactie (extern):**
- Hostinger mailbox `pdfservice@icthorse.nl` aanmaken + SMTP-creds delen
- DNS/nginx-update op icthorse.nl wanneer v0.0.2 deploybaar is

**Wacht op architectuur-beslissing (OPEN-1 t/m OPEN-6 in ARCHITECTURE.md):**
- Frontend host (HC55 vs Hostinger)
- OCR-lib (ocrmypdf vs pytesseract)
- Upload-protocol
- Sig-lib
- Print-strategie
- Mail-archief BCC ja/nee

**Onafhankelijk vervolgwerk (v0.0.2):**
- Frontend skelet (5 tabs)
- Backend skelet (FastAPI /api/health + OCR/mail stubs)
- SHARED_INFRASTRUCTURE.md uitbreiden met :3963 + `/PDFHorse/` location

---

## Verbinding met andere sessies

| Sessie | Locatie | Verbinding |
|---|---|---|
| 2026-06-01 C4-B Hetzner deploy facturatie | iCt_Horse_Facturatie/prompts/2026-06-01_c4b_deploy_plan.md | Zelfde Hetzner-deploy-pattern, poort-nabuur (3962 vs 3963) |
| 2026-05-22 HorseSafe Fase 7 LIVE | HorseSafe/prompts/2026-05-22_horsesafe_fase7_bellare.md | URL-conventie `/HorseSafe/` is template voor `/PDFHorse/` |
| 2026-05-15 iCtHorseAssist newp | iCt_Horse_Assist/prompts/2026-05-15_hervat_R1_shared_infra.md | Sub-master Meta_iCt_Horse_Diensten introductie |
| 2026-05-13 VeiligDelen v0.1.2 | VeiligDelen/prompts/2026-05-13_branding_v012_rebrand.md | Zuster-dienst (privacy-first pattern) |
