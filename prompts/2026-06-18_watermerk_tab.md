---
date: 2026-06-18
repo: PDFHorse
status: done
resume: ""
---

# Watermerk-tab wiren op bestaande watermark-engine (v0.19.0-Geschke)

## Prompt (essentie)
Gebruiker miste een "nieuwe tab" op live PDFHorse. Onderzoek wees uit: een parallelle
(inmiddels afgeronde) sessie pushte alleen de watermerk-**engine** (`js/watermark.js`,
commit `ada1356`) zónder UI-koppeling — geen tab. Opdracht: "controleer of git clean is en
bouw tab".

## Diagnose vooraf
- HC55 live (`:443/PDFHorse/`) = `69f7b49`, 7 tabs, v0.18.0-Oberdiek — correct geserveerd,
  geen cache/proxy (incognito toonde terecht 7 tabs).
- GitHub `origin/main` = `ada1356` (1 vóór HC55): voegt alleen `frontend/js/watermark.js`
  (220 r) toe, nergens aangeroepen → geen 8e tab.
- Geen actieve parallelle sessie (alleen deze claude-proces; geen tmux/locks; laatste commit 49 min oud).

## Gebouwd (v0.18.0-Oberdiek → v0.19.0-Geschke)
Nieuwe tab **💧 Watermerk** bovenop `window.PDFHorseWatermark` (engine v0.1.0). Drie modi:
1. **Tekst toevoegen** — `injectText(bytes, text)`: (vrijwel) onzichtbaar tekst-watermerk
   getegeld in achtergrondkleur; payload in PDF-Keywords.
2. **Beeld toevoegen** — `injectImage(bytes, {svg|pngDataUrl})`: SVG of PNG (PNG→SVG getraceerd),
   herkleurd + getegeld; canonieke SVG als payload.
3. **Lezen** — `read(bytes)`: toont payloads (tekst/SVG) + vaak-herhaalde tekst uit de tekstlaag.

### Wiring
- `frontend/js/app.js` — tab in `tabs`-array (na OCR, vóór Delen), `watermark` state,
  handlers `onWatermark*`/`runWatermark*`/`watermarkReset` (zelfde patroon als sign/fill).
- `frontend/index.html` — `<section x-show="active === 'watermerk'">` met modus-switch;
  `<script src="js/watermark.js">` vóór `app.js`; header-versie → v0.19.0 — Geschke.
- `frontend/i18n.json` — 19 NL→EN entries voor de nieuwe tab (SSOT, geen code-kopie).
- `version.json` — bump 0.19.0-Geschke (Charles Geschke, Adobe-medeoprichter).

## Verificatie
- `node --check` app.js + watermark.js: OK. JSON-validatie i18n.json + version.json: OK.
- Wiring-grep: tab-id, sectie, engine-calls, script-volgorde, 10 handler-refs — alle aanwezig.
- Browser-E2E (Playwright headless Chromium) GEDRAAID: watermerk tekst->lezen vindt de
  payload terug; geen JS-errors. Test in `tests/e2e_tabs.py`. (Bug gevonden+gefixt in v0.20.1:
  lees-`x-for` over `repeatedText` null-safe gemaakt.)

## Deploy
Dev-clone `~/projects/PDFHorse` → push origin → `/opt/pdfhorse` pull → rsync `frontend/`
naar `/var/www/pdfhorse/frontend/`. Live op `https://horsecloud55.ddns.net/PDFHorse/`.

## Open / volgende
- Geavanceerde tab (payload-bestand base64 attach + optioneel encrypt/decrypt met keypair,
  keypair aanmaken/downloaden, public key up/download) — gevraagd, nog te bouwen.
