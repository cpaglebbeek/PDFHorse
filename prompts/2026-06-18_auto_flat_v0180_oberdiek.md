---
date: 2026-06-18
repo: PDFHorse
status: done
resume: ""
---

# Sessie 2026-06-18 — v0.18.0-Oberdiek: AUTO-veldherkenning voor platte PDF's + snap-to-line

**Agent:** Claude Opus 4.7 (1M context)
**Aanleiding:** User: *"verder met pdfhorse"* → onderkende 4 untracked logo-SVG's van vandaag + LIVE v0.17.0-Warnock. Vervolgens: *"auto invullen gaat nog niet optimaal: vergelijk de 2 pdf bestanden die ik mezelf gemaild heb"*.

## Vergelijking — bron-PDF vs filled-PDF

Gedownload via Gmail-MCP naar `/tmp/pdfhorse-fill-compare/`:

| Bestand | Bron | Bytes | Producer | Vorm |
|---|---|---|---|---|
| `A_original_mandaat.pdf` | `christian.glebbeek@dierenbescherming.nl` → self, 18-6 00:22 | 70 836 | wkhtmltopdf 0.12.6.1 / Qt 4.8.7 | DSA SEPA-mandaat, 1p A4, `Form: none` |
| `B_pdfhorse_filled.pdf`  | `info@icthorse.nl` → self, 18-6 00:29 (Outlook FW) | 85 282 | pdf-lib (PDFHorse v0.17.0) | Zelfde A, met 5 hand-geplaatste tekst-velden |

Tekst-extract (`pdftotext -layout`) toont:
- IBAN: `NL12BUNQ2186415933` — geplaatst BOVEN dotted-line, X-offset ~10 ch te ver rechts.
- Tenaamstelling: `M.E.T.S Diensten` — zelfde patroon.
- Volledige naam: `C. Glebbeek` — zelfde.
- Plaats: `Neuw-Vennep` (user-typo, irrelevant).
- Datum: `17-6-2026` — zelfde.

Rasterized crops (`pdftoppm -r 150 -png` + `magick -crop`) bevestigen visueel: 5 fields, allemaal misaligned.

## Root cause — 2 onafhankelijke problemen

1. **AUTO werkt niet op platte PDF's.** `autoDetectFields()` (`app.js:695` v0.17.0) leest alleen `doc.getForm().getFields()` → AcroForm-widgets. DSA-PDF heeft `Form: none` dus AUTO retourneerde directe foutmelding "PDF is plat — plaats handmatig". Patroon geldt voor ~alle wkhtmltopdf/LibreOffice/MS Word forms.
2. **Manuele klik = geen snap.** `addFillField()` (`app.js:639` v0.17.0) registreerde pure muisklik-coords. Geen detectie van onderliggende dot/underscore-lijn → user moest op de pixel raden, met zichtbare drift.

## Beslissing — optie C

User koos uit 4 opties (A snap-only / B AUTO-only / C beide / D laten): **C**. → groene + oranje wijziging = `+0.1.0` = **v0.18.0-Oberdiek**.

## Uitgevoerd

### 1. Detectie via PDF.js text-stream

Verified vooraf met pypdf op A_original_mandaat.pdf: 7 dot-runs (Identificatie code rechts / IBAN / Tenaamstelling / Einddatum / Volledige naam / Plaats ondertekening / Datum ondertekening), allemaal fontSize ~10pt strings van 38–57 punten.

`frontend/js/app.js` — nieuwe helpers:
- **`_collectFlatFields(items, pageIdx, viewportH)`** — itereert PDF.js `text-items`, regex `^[\s]*[.·…_](?:[\s]*[.·…_]){2,}[\s]*$` matcht dot- en underscore-runs (incl. spatie-separated `. . . . . .`). Per match: `x = transform[4]`, `y_baseline = viewportH − transform[5]`, `fontSize = |transform[3]| ∨ |transform[0]|`, `width = item.width`. Push naar `this.fill.detected`.
- **`_mergeAdjacentDetected()`** — sort op (page, y, x); merge adjacente runs als ze (1) zelfde pagina, (2) baseline-Δ ≤ 2 px, (3) X-gap ≤ 20 px. Voorkomt dubbele fields voor "splitse" dot-runs.

Gehaakt in `_fillLoad()` na elke `page.render(...)`: `const tc = await page.getTextContent(); this._collectFlatFields(tc.items, i-1, viewport.height);`. Na de loop: `_mergeAdjacentDetected()`.

### 2. AUTO uitgebreid

`autoDetectFields()` blok na AcroForm-loop: als `added === 0`, itereer `this.fill.detected` en push fields met:
- `x = detected.x`
- `y = detected.y − detected.fontSize × 0.55` (tekst BOVEN dot-lijn — handgeschreven-stijl)
- `fontSize = max(8, min(user-fontSize, round(detected.fontSize × 0.85)))`
- `snapped: true`

Notice: *"N invulveld(en) visueel herkend (platte PDF, op basis van dotted/underscore-lijnen)"*. Error-fallback alleen als noch AcroForm noch visuele runs gevonden.

### 3. Snap-to-line bij manuele klik

`addFillField(ev, pageIdx)`:
- CSS→canvas-pixel scaling toegevoegd: `sx = canvas.width / rect.width`, `sy = canvas.height / rect.height`. Voorkomt drift wanneer canvas via CSS gerescaled (kleine viewports).
- Roept `_findSnapCandidate(pageIdx, rawX, rawY)` aan: zoekt detected run met (1) zelfde page, (2) `|d.y − y| ≤ 18 px`, (3) `x ∈ [d.x − 24, d.x + d.width + 24]`. Scoort op `dy × 10 + horizontale-overshoot`.
- Bij hit: `x = snap.x`, `y = snap.y − snap.fontSize × 0.55`, `fontSize = round(snap.fontSize × 0.85)`. Bij miss: rauwe coords (oude gedrag).
- `field.snapped = !!snap` voor toekomstige UI-indicator.

### 4. UI-tekst

`frontend/index.html:278` — bijschrift onder AUTO-knop:
> "Plaatst automatisch invulvelden — AcroForm-widgets én, voor platte PDF's, dotted-line/underscore-velden."

## Verificatie

### Backend
```
$ python -m pytest backend/tests/ -q
20 passed, 39 warnings in 1.08s
```

### Frontend syntax
```
$ node --check frontend/js/app.js
syntax OK
```

### Regex-unit-test (`node`)
11/11 cases ok — match: 3+ dots/middots/underscores, spatie-separated dots, underscores. Skip: short runs, normale tekst, IBAN, datum.

### E2E Playwright-test (`/tmp/pdfhorse-fill-compare/test_autofill.py`)
Serveert `frontend/` statisch op `127.0.0.1:8765`, laadt `A_original_mandaat.pdf`, klikt AUTO, dumpt state, downloadt resultaat, rasterizeert.

Resultaat:
```
DETECTED 7 dot-runs (allemaal fs=10.25 op page 0):
  x=297 y=482 w=137  (Identificatie code rechts — twee runs gemerged: 92+45)
  x=146 y=554 w=92   (IBAN)
  x=104 y=569 w=92   (Tenaamstelling)
  x=403 y=630 w=92   (Einddatum optioneel)
  x=105 y=685 w=92   (Volledige naam)
  x=399 y=685 w=92   (Plaats ondertekening)
  x=403 y=711 w=92   (Datum ondertekening)
NOTICE: 7 invulveld(en) visueel herkend (platte PDF, ...)
PLACED 7 fields (allemaal snapped=true, fontSize=9)
PASS: 7 detected, 7 placed
```

Output `C_autofilled.pdf` → rasterized crop `C_crop_fields.png` + `C_crop_sign.png` tonen: tekst NETJES boven de dot-lijn, X-aligned met veld-start. Vergeleken met `B_pdfhorse_filled.pdf`: dramatisch beter.

## Files

| File | Δ | Beschrijving |
|---|---|---|
| `frontend/js/app.js` | +118/−8 | `fill.detected` state, `_collectFlatFields`, `_mergeAdjacentDetected`, `_findSnapCandidate`; `_fillLoad` + `addFillField` + `autoDetectFields` + `fillReset` aangepast |
| `frontend/index.html` | +1/−1 | AUTO-knop bijschrift |
| `frontend/index.html` | +1/−1 | Versielabel header v0.17.0 → v0.18.0 |
| `version.json` | rewrite | 0.17.0-Warnock → 0.18.0-Oberdiek |
| `README.md` | +1/−1 | Versie-line |
| `CHANGELOG.md` | +37 | Entry v0.18.0-Oberdiek |
| `prompts/2026-06-18_auto_flat_v0180_oberdiek.md` | new | dit bestand |

## Limitaties

- **Vector-stroke lijnen** (echte horizontale lijntjes via `re`/`l` operators) worden NIET gedetecteerd — alleen text-rendered dots/underscores. Voor MS Word forms met "tab-leader dots" werkt het meestal wel (worden als chars gerenderd). Echte form-lines (PowerPoint export, sommige LibreOffice templates) faalt.
- **Image-only PDF's** (gescand) zijn al gedekt door OCR-tab — fill-AUTO doet daar niets nuttigs.
- Geen UI-overlay die detected fields visueel highlight; AUTO-knop is de UI. `field.snapped` kan later worden gebruikt voor een groen randje rond snapped fields.

## Volgende stappen — optioneel

- **v0.19.0-Hosny:** UI-overlay die detected dot-lines pre-highlight bij hover (faint rectangle). Maakt detection zichtbaar zonder direct te plaatsen.
- **v0.20.0-Berry:** vector-stroke detectie via pdf-lib content-stream parser (zoek `m`+`l`-sequenties met horizontale lijntjes). Risico op false positives in decoratie/footer-lijnen.
- **v1.0.0-Brotz:** Hostinger reverse-proxy `icthorse.nl/PDFHorse/` + per-tab in-use screens + pen-test.

## Deploy

```bash
# Lokaal commit + push
git add frontend/js/app.js frontend/index.html version.json README.md CHANGELOG.md prompts/2026-06-18_auto_flat_v0180_oberdiek.md
git commit -m "PDFHorse v0.18.0-Oberdiek — AUTO werkt nu ook op platte PDF's + snap-to-line bij manuele klik"
git push

# HC55 (na user-akkoord)
ssh hc55 'cd /opt/pdfhorse && git pull && rsync -a --delete frontend/ /var/www/pdfhorse/frontend/ && systemctl restart pdfhorse'
```

## Status

**DONE.** Code in main, lokaal getest e2e. Wacht op user-akkoord voor HC55-deploy.
