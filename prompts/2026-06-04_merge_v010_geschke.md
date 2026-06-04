---
date: 2026-06-04
repo: PDFHorse
status: open
resume: "verder met pdfhorse — split-feature na v0.1.0-Geschke merge"
---

# Sessie 2026-06-04 — v0.1.0-Geschke: client-side merge

**Agent:** Claude Opus 4.7 (1M context)
**Repo:** PDFHorse (cpaglebbeek/PDFHorse)
**Branche:** main
**Cross-repo werk:** Meta_Master (memory + STATUS update bij OEU)
**Eindstand commits:** zie `git log` (commit deze sessie nog niet gehasht op moment van schrijven)

---

## Opdracht (samengevat)

Verder met PDFHorse. Plan: eerste werkende feature implementeren → oranje bump naar v0.1.0-Geschke. Gekozen: client-only merge via pdf-lib (CDN), passend bij privacy-belofte (geen upload).

---

## Prompts en acties — chronologisch

### Prompt 1 — "verder met pdfhorse"
**Actie:** Memory + ACTIONS.md gelezen → status `v0.0.2-Warnock skelet`. WhatIf-plan voorgelegd voor v0.1.0-Geschke met merge als enige feature deze ronde.
**Keuze:** Merge eerst (eenvoudigst, fully client-side); split/fill/sign/ocr volgen in latere oranje bumps.

### Prompt 2 — "akkoord, ga door met merge"
**Actie:**
- `version.json` → `0.1.0` / `Geschke` / `first-feature`
- `frontend/index.html`: pdf-lib CDN-script + header-label `v0.1.0 — Geschke` + merge-section uitgebouwd (drop-zone met dragover-state, hidden file-input, file-list met ↑/↓/✕, "Samenvoegen"-knop, foutmelding/notice-velden)
- `frontend/js/app.js`: `merge` state (`files`, `dragOver`, `busy`, `error`, `notice`, `seq`) + `_mergeAddFiles` (type+size+sessietotaal-validatie) + `mergeMove`/`Remove`/`Reset`/`Total` + `runMerge` (pdf-lib `PDFDocument.create` + `load(ignoreEncryption:false)` + `copyPages` + `save` + Blob-download) + `_downloadBlob` helper + `formatBytes` helper
- `ACTIONS.md`: merge afgevinkt, header sectie hernoemd `v0.1.0-Geschke → v0.2.0`
- `ARCHITECTURE.md`: Merge data-flow geactualiseerd ("geïmplementeerd in v0.1.0-Geschke") met validatie-flow en CDN-versie
- `docs/DESIGN_TOKENS.md` (NIEUW): kleuren/typo/spacing/states/a11y volgens CLAUDE.md-eis "na eerste UI-werk"
- `docs/DEPENDENCIES.md` (NIEUW): frontend + backend deps + impact-matrix
- `prompts/2026-06-04_merge_v010_geschke.md` (deze file)
- Tests: pytest 4/4 groen (geen backend-wijziging), `node --check` op app.js OK, Node smoke met pdf-lib 1.17.1 mergt 2 dummy-PDFs (2+3 pages) → 5 pages ✓
**Keuze:** Geen SRI-hashes op CDN-scripts (genoteerd als open punt v0.2.x). Geen self-hosting van vendor (mitigatie genoteerd in DEPENDENCIES impact-matrix).

---

## Belangrijke keuzes deze sessie

| Keuze | Reden |
|---|---|
| Merge vóór split | Eenvoudigste flow, geen page-range parsing, snelste win |
| pdf-lib via unpkg CDN, geen self-host | Houdt repo licht + geen build-step (zoals besloten in CLAUDE.md) |
| `ignoreEncryption: false` + nette foutmelding | Versleutelde PDFs falen expliciet i.p.v. stille merge met lege pages |
| Client-side size-limits (50/100 MB) ook al gaat er niets naar server | UX-consistentie met server-limits + RAM-bescherming browser |
| Drag-to-reorder via ↑/↓-knoppen (geen HTML5 drag-drop in list) | Toetsenbord-bereikbaar, simpel, geen extra lib |
| `URL.revokeObjectURL` na 1s | Voorkomt memory-leak bij meerdere merges op rij |
| `node --check` + Node-side smoke i.p.v. browser-screenshot | Browser is niet automatisch te starten in deze omgeving; gebruiker test visueel |

---

## Open eindjes na deze sessie

**Klaar voor verzending / publicatie:**
- v0.1.0-Geschke runnable lokaal — open `frontend/index.html` direct in browser (backend niet vereist voor merge)
- HC55 deploy nog niet uitgevoerd (wacht op Hostinger mailbox voor v0.0.3 OCR+mail; merge zelf vereist geen backend, kan los gedeployed worden)

**Open / volgende sessie:**
- **Split-feature** (page-ranges, client-only pdf-lib) — volgende oranje bump
- **Fill-feature** + **Sign-feature** (3 modi) — later
- **OCR + mail backend** — wacht op Hostinger mailbox-creds (gebruikersactie)
- **HC55 deploy** — kan voor merge-only versie nu al; rsync `frontend/` → HC55 + nginx-snippet activeren
- **Cross-repo:** nginx-config `/PDFHorse/` in `iCt_Horse` repo + footer-link
- **Browser-smoke door gebruiker:** 2 PDFs uploaden via drop-zone én via file-input, ↑/↓ testen, ✕ testen, Samenvoegen klikken → merged.pdf in Downloads, openen en visueel checken dat pagina's correct geconcateneerd zijn
- **Future:** SRI-hashes op alle CDN-scripts (v0.2.x)
- **Future:** self-host vendor onder `/PDFHorse/vendor/` voor offline-mode (PWA, v1.x)
