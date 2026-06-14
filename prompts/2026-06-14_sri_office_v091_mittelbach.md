---
date: 2026-06-14
repo: PDFHorse
status: done
resume: ""
---

# Sessie 2026-06-14 — v0.9.1-Mittelbach: SRI-hardening + ODT/RTF endpoints

**Agent:** Claude Opus 4.7 (1M context, ~20% verbruikt bij start)
**Aanleiding:** Na v0.9.0-Lamport (mail LIVE) gevraagd "1+2 doen" — SRI + .odt/.rtf bundeling.

## Uitgevoerd — Security (SRI)

- Hash-berekening voor 4 CDN-scripts via `curl + openssl dgst -sha384 -binary | openssl base64 -A`:
  | Script | Versie | Bytes | sha384 |
  |---|---|---|---|
  | pdf-lib | 1.17.1 | 525099 | `weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI` |
  | PDF.js | 4.0.379 | 305665 | `uwJM5C0hGZH5Ed/vHx4Ht1PUd8ABIDVIcLbHydZOdFL5eTUG8Jdr32xNVIyn0kYH` |
  | signature_pad | 5.0.4 | 12770 | `sAvQstqOmAfqxD54T2ZBU8/E8IQJJuNT4hEHwUULkoBRze+eTQ7tZNcXEA5yPzhE` |
  | Alpine | 3.14.1 | 44659 | `l8f0VcPi/M1iHPv8egOnY/15TDwqgbOR1anMIJWvU6nLRgZVLTLSaNqi/TOoT5Fh` |
- `frontend/index.html`: alle 4 `<script>`-tags met `integrity="sha384-..." crossorigin="anonymous" referrerpolicy="no-referrer"`.
- Alpine gepind van `3.x.x` (floating) op `3.14.1` — SRI vereist exacte versie.
- **Uitgezonderd:** Tailwind Play CDN (per-request build, hash niet stabiel); PDF.js worker (geen integrity-attribute mogelijk via `GlobalWorkerOptions`). Gedocumenteerd in `index.html`-comment, `PRIVACY.md`, `CHANGELOG.md`.

## Uitgevoerd — Format-uitbreiding (ODT + RTF)

- `backend/main.py`: `ODT_MIME`, `RTF_MIME`, `MAX_ODT_BYTES`, `MAX_RTF_BYTES` constants; 2 nieuwe endpoints via bestaande `_office_to_pdf`-helper (DRY).
- `frontend/js/app.js`: `ODT_MIME` + `RTF_MIME` constants; `_convertDetectKind` uitgebreid; limit-check, route-keuze (nu generiek `/api/convert/${kind}-to-pdf`) en filename-regex uitgebreid.
- `frontend/index.html`: accept-attribuut uitgebreid, intro-tekst + helptekst aangepast, 2 nieuwe kind-badges (indigo voor ODT, rose voor RTF).
- Geen nieuwe HC55-deps — LibreOffice writer kan `.odt` native (zelfde format-familie als .docx) en `.rtf` via import-filter, al geïnstalleerd in v0.6.0-Paxton.

## Tests

- 3 nieuwe pytest-cases: 415 odt-extensie, 415 rtf-extensie, 503 odt-zonder-soffice (rtf-variant skip wegens identieke pad).
- pytest 20/20 groen (17 → 20).
- `node --check frontend/js/app.js` → OK.

## Codename — Frank Mittelbach

LaTeX3-team-lead sinds 1990, document-format engineering + kwaliteits-borging. Past bij security-hardening (SRI = payload-integrity) + format-uitbreiding. Volgende lijn na Knuth (TeX) → Reid (Scribe) → Lamport (LaTeX). Brotz blijft v1.0.0 reserve.

## HC55 deploy

```bash
ssh horsecloud55
cd /opt/pdfhorse && git pull --ff-only origin main
sudo rsync -a --delete /opt/pdfhorse/frontend/ /var/www/pdfhorse/frontend/
sudo systemctl restart pdfhorse
curl -s http://127.0.0.1:3963/api/health   # → 0.9.1/Mittelbach
# E2E smoke odt/rtf: maak test-bestand → POST /api/convert/odt-to-pdf
```

## Open na deploy

- E2E smoke odt + rtf via curl (Mac heeft `pandoc` of zelf-gegenereerd).
- v1.0.0-Brotz major release: icthorse.nl reverse-proxy, `docs/screens/` vullen, eventueel pen-test.
