---
date: 2026-06-17
repo: PDFHorse
status: done
resume: "v0.10.0-Thanh LIVE. Volgende open feature: clipboard/sessie-deel via code (icthorse.nl/clipboard-stijl) — aparte WhatIf, raakt backend (gedeelde state + codes), botst met huidige stateless/no-DB ontwerp."
---

# v0.10.0-Thanh — verplaatsbare handtekening + Fill→Sign overdracht

## Vraag (Christian)
1. "geplaatste handtekening moet verplaatsbaar zijn"
2. "na invullen moet ik als ik naar tab handtekening ga verder kunnen gaan met het zetten van de handtekening"

Akkoord (WhatIf): bouwen als v0.10.0-Thanh; Fill→Sign overgang = **automatisch + knop**.

## Wijzigingen (client-only, geen backend)
### Frontend `app.js`
- `signHandoff`-state: `{ bytes, name }` of `null`.
- `goTab(id)` — tab-navigatie; auto-overname ingevulde PDF bij wissel naar Ondertekenen (als nog geen sign-bestand).
- `continueToSign()` — laadt de overdracht in de sign-tab + notice.
- `_signLoad` opgesplitst → `_signLoad` (uploadpad, validatie + arrayBuffer) + `_signLoadBytes(bytes, name)` (laden uit geheugen + render). Pseudo-bestand `{ name }` als er geen echt File-object is.
- `startSignDrag($event, p)` — versleep geplaatste handtekening via pointer-events (muis/touch/pen); klemt binnen canvas; rect per move opnieuw gemeten (scroll-safe); pointer-capture.
- `runFill` zet `signHandoff` klaar + notice "ga door naar Ondertekenen".

### `index.html`
- Tab-knoppen: `@click="goTab(t.id)"`.
- Handtekening-overlay `<img>`: `cursor-move select-none touch-none` + `draggable="false"` + `@pointerdown="startSignDrag($event, p)"`.
- Invullen-tab: knop **"→ Onderteken deze PDF"** (`x-show="signHandoff"`).
- Hint-tekst sign-tab: klik + verslepen.
- Header → v0.10.0 — Thanh.

### Versie/docs
- `version.json` → 0.10.0 / Thanh / 2026-06-17.
- `CHANGELOG.md` v0.10.0-Thanh entry.

## Codenaam
**Hàn Thế Thành** — uitvinder pdfTeX (PDF uit TeX). PDF-pioniers/LaTeX-lijn na Knuth/Reid/Lamport/Mittelbach. `Brotz` blijft v1.0.0 reserve.

## Verificatie
- `node --check frontend/js/app.js` ✓
- Backend ongewijzigd → pytest 20/20 blijft.
- Deploy: `git pull` /opt/pdfhorse + rsync frontend → /var/www/pdfhorse/frontend + `systemctl restart pdfhorse`.
- Live health moet 0.10.0/Thanh tonen.
