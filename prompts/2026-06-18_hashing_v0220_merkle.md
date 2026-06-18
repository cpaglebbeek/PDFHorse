---
date: 2026-06-18
repo: PDFHorse
status: done
resume: ""
---

# Hashing-tab + Proof of Authenticity (v0.22.0-Merkle)

## Prompt (essentie)
"debug: ik mis in produktie een tab hashing met file hashing, conceptual hashing en
blockchain anchoring met embedding van de hash na hashing als payload en visueel
watermerk en rapportage bij aanmaken proof of authenticity / first owner."

Diagnose: geen deploy-drift — feature was nooit gebouwd. Productie (`de588a9`) draait
exact wat in main staat: 9 tabs zonder Hashing.

## Gekozen scope (A1 + B3)
- **A1** Anchoring via **OpenTimestamps** (gratis, Bitcoin-anchor, geen wallet/keys).
- **B3** PoA-rapport zowel als losse `.pdf` download als embedded bijlage in de PDF.

## Architectuur

### Nieuw
- `backend/main.py` — endpoint `POST /api/anchor` (proxy naar OpenTimestamps
  calendar `a.pool.opentimestamps.org/digest` om CORS te omzeilen; rate-limit
  gerust binnen `MAIL_RATE_PER_HOUR`-mechaniek; stub-mode via env
  `PDFHORSE_ANCHOR_STUB=1` voor tests/dev).
- `frontend/js/hash.js` — `window.PDFHorseHash` engine:
  - `fileHashes(bytes)` — SHA-256 + SHA-512 via WebCrypto.
  - `conceptualHash(pdfBytes)` — PDF.js text-extract → normalize (NFC, lowercase,
    whitespace-collapse, strip control) → SHA-256.
  - `pagePerceptualHashes(pdfBytes)` — per pagina render → 8x8 grayscale →
    avg-hash (64-bit). Robuust voor lichte visuele wijzigingen.
  - `anchorOTS(sha256bytes, base)` — POST naar `/api/anchor` → krijgt `.ots`-bytes terug.
  - `verify(pdfBytes)` — herbereken alle hashes + vergelijk met embedded payload.
- `frontend/js/poa-report.js` — `window.PDFHorsePoaReport`:
  - `build(meta)` — genereert een nette PDF (pdf-lib) met titel "Proof of
    Authenticity", owner, alle hashes, anchor-bewijs hex, tijdstempel, verify-stappen.
- `frontend/index.html` — 🔒 Hashing-tab + secties: hash-modus, verify-modus,
  resultaat, downloads.
- `frontend/i18n.json` — ~30 NL/EN entries.
- `frontend/js/app.js` — tab in `tabs[]`, `hashing` state, handlers.
- `tests/e2e_tabs.py` — Test #7 hashing happy path met stub-anchor.

### Hergebruik (geen nieuwe engines)
- `PDFHorsePayload.attach()` voor:
  1. `pdfhorse-payload.json` met PoA-envelope `{file_sha256, concept_sha256,
     page_phashes[], ots_b64, owner, ts}`.
  2. `pdfhorse-poa.pdf` als embedded bijlage (B3 onderdeel).
- `PDFHorseWatermark.injectText()` voor visueel watermerk
  `SHA-256:<8>… · PoA <iso> · iCt Horse` (footer-tekst, optioneel uit).

## Flow

```
PDF in
  ├─ fileHashes ────────────────┐
  ├─ conceptualHash ────────────┤
  ├─ pagePerceptualHashes ──────┤
  └─ POST /api/anchor → .ots ──┐│
                               ▼▼
                         payload-envelope
                               │
                               ├─ PDFHorsePayload.attach (pdfhorse-payload.json)
                               ├─ PDFHorsePoaReport.build → poa.pdf
                               ├─ PDFHorsePayload.attach (pdfhorse-poa.pdf)
                               └─ PDFHorseWatermark.injectText (zichtbaar)
                                       │
                                       ▼
                              <basename>_poa.pdf  (download #1)
                              poa-report.pdf      (download #2)
```

## Verificatie (uitgevoerd)
- `node --check` hash.js + poa-report.js + app.js: groen
- JSON-valid i18n + version: groen
- **Backend pytest 27/27 groen** (20 oud + 7 nieuw `/api/anchor`)
- **Playwright E2E 8/8 groen** — sign + 2 downloads + verify (signed-PDF → "Verificatie geslaagd ✓")
- RCA-fix: conceptueel-hash filter voor PDFHorse-watermerk-tegels (prefix-match, ook truncated `iCt H` aan paginarand)
- PoA-rapport WinAnsi-safe gemaakt (`_ascii()` strip → Helvetica geen Unicode-throw)

## Deploy
Push origin → `/opt/pdfhorse` pull → rsync frontend → `/var/www/pdfhorse/frontend/`
→ `systemctl restart pdfhorse` → smoke /api/health.

## Codenaam
**Ralph Merkle** — uitvinder Merkle-trees, fundament onder hash-anchoring én
Bitcoin's block-tree. Past 1:1 bij feature-thema.
