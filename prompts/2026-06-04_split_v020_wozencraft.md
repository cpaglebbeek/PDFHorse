---
date: 2026-06-04
repo: PDFHorse
status: open
resume: "verder met pdfhorse — fill-feature (tekstvelden) na v0.2.0-Wozencraft split"
---

# Sessie 2026-06-04 — v0.2.0-Wozencraft: client-side split

**Agent:** Claude Opus 4.7 (1M context)
**Repo:** PDFHorse (cpaglebbeek/PDFHorse)
**Branche:** main
**Cross-repo werk:** Meta_Master (PROJECTS.json + STATUS.md + RESUME.md + claude_memory sync)
**Eindstand commits:** zie `git log` (hash deze sessie nog niet bekend op moment van schrijven)

---

## Opdracht (samengevat)

Vervolg op v0.1.0-Geschke merge: tweede werkende feature implementeren. Gekozen: client-only split via pdf-lib met page-range syntax. Oranje bump v0.1.0 → v0.2.0. Codenaam Wozencraft (PDF-pioniers shortlist; Brotz blijft gereserveerd voor v1.0.0).

---

## Prompts en acties — chronologisch

### Prompt 1 — "/sanitycheck en /verifyrules" (voorafgaand)
**Actie:** Read-only audit van repo + naleving sessie-regels. Score 62% / 7-13 nageleefd. P1: README-drift v0.0.1 → v0.1.0 + Meta_Master sync; P2: PRINCIPLES/PRIVACY/BUGLIST/screens.
**Keuze:** P1 eerst, P2 voor latere sessie.

### Prompt 2 — "akkoord" (op P1)
**Actie:** README.md PDFHorse herschreven naar v0.1.0-Geschke + statuskolom + uitgebreid codenamen-tabel. Meta_Master/PROJECTS.json PDFHorse-entry naar v0.1.0/Geschke/first-feature. STATUS.md vervolg-21 entry. RESUME.md regenereerd (139 items / 142 repos). claude_memory mirror.
**Incident:** parallelle agent (HeeresReformed-sessie) scoopte mijn ongecommiteerde PROJECTS/STATUS/RESUME files mee in haar commit `f221015 HeeresReformed v0.1.0-CentraalBeheer LIVE` via `git add -A` of `.`. Inhoud bewaard, geen schade — wel multi-session signaal-incident, klassiek scenario uit `feedback_multi_session_safety.md`. Gerapporteerd aan gebruiker.

### Prompt 3 — "ga door met split"
**Actie:**
- `version.json` → 0.2.0 / Wozencraft / second-feature
- `frontend/index.html`: header v0.2.0-Wozencraft + split-section volledig herschreven (drop-zone met dragover, hidden file-input, geparste page-count tonen, range-input met live-validatie + visuele lijst van geparste ranges + Splitsen-knop + status-velden)
- `frontend/js/app.js`: `split`-state + `_splitSetFile()` (PDF-validatie + pdf-lib load + pageCount tonen) + `parseSplitRanges()` (regex-validatie + bounds-check + geen achteruit-bereiken) + `splitReset()` + `runSplit()` (per range nieuw PDFDocument + copyPages + save + Blob-download + 200ms delay tussen downloads + revokeObjectURL na 1s) + `_sleep()` helper
- `ACTIONS.md`: split afgevinkt, sectie hernoemd v0.2.0 → v0.3.0
- `ARCHITECTURE.md`: split data-flow van "client-only" naar "geïmplementeerd in v0.2.0-Wozencraft" met validatie- en download-flow
- `docs/DEPENDENCIES.md`: pdf-lib status uitgebreid (v0.1.0 merge + v0.2.0 split), versiehistorie-rij v0.2.0 toegevoegd
- `prompts/2026-06-04_merge_v010_geschke.md`: status `done` + resume leeg
- Tests: pytest 4/4 groen, `node --check` OK, Node smoke met 10-page PDF + ranges "1-3, 5, 8-10" → 3 output-PDFs van 3/1/3 pages ✓
**Keuze:** Geen ZIP (vermijdt JSZip-dep — kan later). Geen drag-to-reorder van ranges (volgorde = invoervolgorde, simpel). Filename-conventie `<basename>_pages_X-Y.pdf` of `<basename>_page_N.pdf` (consistent + leesbaar).

---

## Belangrijke keuzes deze sessie

| Keuze | Reden |
|---|---|
| Split vóór fill/sign | Logisch vervolg merge (zelfde lib, complementaire UX) |
| Range-syntax i.p.v. visuele page-selector | Compact + toetsenbord-vriendelijk; visuele selector kan later v0.3.x met PDF.js thumbnails |
| 200ms delay tussen downloads | Browser-popup-blocker mitigation bij N > 1 |
| Geen ZIP-output | Vermijdt JSZip-dep, browser-prompts oké voor MVP |
| Strikte regex `^[\d,\s-]+$` op input | Voorkomt injectie/edge-cases; verwerpt al input vóór per-deel parsing |
| Live-feedback bij elke toetsaanslag | UX: gebruiker ziet meteen wat geparseerd wordt + waar fout zit |
| Bestaande `_downloadBlob`/`formatBytes` hergebruikt | DRY; merge en split delen helpers |

---

## Open eindjes na deze sessie

**Klaar:**
- v0.2.0-Wozencraft runnable lokaal — open `frontend/index.html` direct in browser (geen backend nodig voor split)
- Backend ongewijzigd; geen HC55-redeploy nodig

**Open / volgende sessie:**
- **Fill-feature** (vrije tekstvelden, klik-om-te-plaatsen, pdf-lib drawText) — volgende oranje bump v0.3.0
- **Sign-feature** (3 modi: bitmap/SVG/live) — daarna
- **OCR + mail backend** — wacht op Hostinger mailbox-creds
- **HC55 deploy van merge+split-versie** — kan al
- **Browser-smoke door gebruiker:** open `frontend/index.html`, kies 1 PDF, type ranges, druk Splitsen → N downloads in Downloads, openen + visueel checken
- **Future v0.2.x:** SRI-hashes op CDN-scripts, optionele ZIP-output, PDF.js page-thumbnails als visuele alternatief voor range-input
- **P2 uit sanitycheck:** docs/PRINCIPLES.md, docs/PRIVACY.md, docs/BUGLIST.md, CHANGELOG.md
