---
date: 2026-06-18
repo: PDFHorse
status: done
resume: ""
---

# Watermerk-tab: document als payload-watermerk (v0.21.0-Bienz)

## Prompt (essentie)
"bij watermerk: optie: watermerk in de vorm van payload (upload document). dat moet ook weer uit te lezen zijn."

## Gebouwd (v0.20.1-Wozencraft → v0.21.0-Bienz)
4e modus in de Watermerk-tab: **Document toevoegen**. Upload een willekeurig document →
ingebed als (onzichtbare) base64-payload in de PDF, terug te lezen via modus **Lezen**.

- **Hergebruik** `PDFHorsePayload`-engine (geen nieuwe engine): `buildPlain(name, bytes)` +
  `attach(pdfBytes, envelope)` → echte PDF embedded-file attachment (`pdfhorse-payload.json`).
  Plain (onversleuteld) — past bij het "watermerk"-karakter.
- **Lezen uitgebreid:** `runWatermarkRead()` doet naast `PDFHorseWatermark.read()` (tekst/SVG
  Keywords-payloads) nu ook `PDFHorsePayload.extract()` → toont de embedded document-payload
  met **⬇ Download**-knop. Versleutelde payload (uit Geavanceerd-tab) toont hint → open via
  🔐 Geavanceerd met private key.
- **Cross-compatibel** met de Geavanceerd-tab: zelfde attachment, dus een doc ingebed via
  Watermerk is ook uithaalbaar via Geavanceerd en omgekeerd.

### Wiring
- `app.js`: watermark state `docBytes`/`docName`/`readDoc`; handlers `_payloadEngine`,
  `onWatermarkDoc`, `runWatermarkDoc`, `downloadWatermarkDoc`; `runWatermarkRead`-uitbreiding.
- `index.html`: modus-knop "Document toevoegen", doc-blok (#watermark-doc-input), document-payload
  weergave + download in lees-uitvoer; header v0.21.0 — Bienz.
- `i18n.json`: 6 NL→EN entries. `version.json`: v0.21.0-Bienz (Tim Bienz, PDF Reference co-auteur 1993).

## Verificatie
- `node --check` + JSON valid: OK.
- Playwright E2E **5/5 groen** (`tests/e2e_tabs.py`, Test 4 toegevoegd):
  document inbedden → lezen → download **byte-exact** (34/34 bytes). Geen JS-errors.

## Deploy
Dev-clone push → `/opt/pdfhorse` pull → rsync → `/var/www/pdfhorse/frontend/`.
Live: `https://horsecloud55.ddns.net/PDFHorse/` (poort 443).
