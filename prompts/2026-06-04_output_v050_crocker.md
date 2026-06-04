---
date: 2026-06-04
repo: PDFHorse
status: open
resume: "verder met pdfhorse — OCR backend (Tesseract install + ocrmypdf endpoint) na v0.5.0-Crocker output-bar"
---

# Sessie 2026-06-04 — v0.5.0-Crocker: output-bar (Download / Print / Mail)

**Agent:** Claude Opus 4.7 (1M context)
**Repo:** PDFHorse + HC55 redeploy
**LIVE URL:** `https://horsecloud55.ddns.net/PDFHorse/`

## Opdracht

Vervolg op v0.4.0-Taft sign + HC55 MVP-deploy. Output-bar als laatste client-side ronde voordat backend-werk (OCR + mail) begint.

## Uitgevoerd

- `version.json` → 0.5.0 / Crocker / fifth-feature
- `frontend/index.html` header v0.5.0-Crocker + output-section vervangen door werkende variant: filename + feature-label + grootte + 3 knoppen (Download, Print, Mail) + uitklapbaar mail-form (recipient + subject + Verstuur)
- `frontend/js/app.js`:
  - nieuwe `output`-state (bytes, filename, feature, mime, mailOpen, mailTo, mailSubject, mailBusy, mailStatus, error)
  - `_setOutput(bytes, filename, feature, mime)` — kloont naar nieuwe Uint8Array zodat origin-buffer niet vasthoudt
  - `downloadLast()` — re-trigger via bestaande `_downloadBlob`
  - `printLast()` — hidden iframe met Blob-URL → `iframe.onload` → `contentWindow.print()` met try/catch + revokeObjectURL na 60s
  - `mailLast()` — POST `/api/mail` multipart (to, subject, pdf), regex-validatie e-mail, 200/501/fout-paden netjes
  - Alle 4 features (merge/split/fill/sign) roepen `_setOutput` na hun `_downloadBlob`
  - Split N-outputs: alleen de laatste range wordt naar output-bar geschreven (UX-keuze)

- `ACTIONS.md` output-bar afgevinkt + HC55 deploy afgevinkt + sectie hernoemd v0.5.0 → v0.6.0
- `ARCHITECTURE.md` mail-flow gemarkeerd "frontend gebouwd in v0.5.0, backend 501-stub" + nieuwe Output-bar data-flow sectie
- `CHANGELOG.md` v0.5.0-Crocker entry bovenaan
- prompts/2026-06-04_output_v050_crocker.md NIEUW status open

## Tests

- pytest 4/4 groen (backend ongewijzigd)
- `node --check` op app.js OK
- Geen Node smoke — output-bar is JS-only (geen pdf-lib operatie nieuw te valideren)

## HC55 redeploy

- git pull op `/opt/pdfhorse` → 8198db0 + 13643fe in (nieuwste commit eindstand)
- rsync frontend → `/var/www/pdfhorse/frontend/`
- systemctl restart pdfhorse (backend leest version.json opnieuw)
- Publieke smoke: `/api/health` toont 0.5.0/Crocker; frontend toont `v0.5.0 — Crocker`

## Belangrijke keuzes

| Keuze | Reden |
|---|---|
| Output-bar onderaan, persistent zichtbaar in elke tab | Toegang tot laatste output zonder tab-wissel |
| Klone bytes naar nieuwe Uint8Array in `_setOutput` | Voorkomt afhankelijkheid van pdf-lib intern buffer |
| Print via hidden iframe + `contentWindow.print()` | Standaard cross-browser methode voor PDF print; `window.open` wordt vaak geblokkeerd |
| Mail-form NU bouwen ondanks 501 backend | UX-werk staat los van backend-readyness; gebruikers zien de flow al |
| Mail-validatie regex naast `type=email` | Browser-validatie is laks; expliciete check vermijdt onnodige POSTs |
| 501-response → "nog niet actief" melding (geen rood) | UX: dit is een verwachte state, geen fout |
| Split → laatste range naar output-bar | Eenvoudiger dan multi-output-bar; gebruiker krijgt alsnog alle N auto-downloads |
| Codename Steve Crocker (afwijkend van Adobe-traditie) | Output = "data naar buiten" — internet-pionier symbolisch passend; gedocumenteerd in CHANGELOG |

## Open

- **OCR backend** (resume-trigger v0.5.0): Tesseract install + ocrmypdf endpoint op HC55
- **Mail backend**: wacht op Hostinger mailbox-creds → vervang dummy `.env` → implementeer SMTP-call
- **icthorse.nl/PDFHorse/**: Hostinger reverse-proxy of mirror
- **docs/screens/**: screenshots vanaf live URL
- **SRI-hashes** op CDN-scripts
- **HC55 nginx-cleanup**: `.bak`-files in sites-enabled
