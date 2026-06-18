---
date: 2026-06-18
repo: PDFHorse
status: done
resume: ""
---

# Geavanceerd-tab: payload-bestand + keypair encrypt/decrypt (v0.20.0-Wozencraft)

## Prompt (essentie)
"nu nog een feature: geavanceerd tab (engine) payload: upload/download van een binary/bestand
dat middels base64 wordt geattached; optioneel: encrypt/decrypt met private/public key.
optie: aanmaken keypair, downloaden keypair, downloaden public key, uploaden public key (peer)."

Keuze gebruiker: **volledig zoals voorgesteld** (payload-attach + hybride RSA-OAEP/AES-GCM + keypair JWK).

## Gebouwd (v0.19.0-Geschke → v0.20.0-Wozencraft)
Nieuwe tab **🔐 Geavanceerd** + engine `js/payload.js` (`window.PDFHorsePayload` v0.1.0).

### Payload-embed/extract
- Inbedden: bestand → base64-envelope → **echte PDF embedded-file attachment** (pdf-lib `doc.attach`,
  naam `pdfhorse-payload.json`, JSON `{pdfhorse:'payload-v1', envelope}`).
- Uithalen: PDF.js `getAttachments()` → envelope → base64-decode → (decrypt) → download origineel.

### Crypto (optioneel, hybride)
- AES-GCM-256 versleutelt het bestand (random 12-byte IV).
- RSA-OAEP-2048 (SHA-256) wrapt de 32-byte AES-sessiesleutel met de **public key van de ontvanger**.
- Envelope: `{enc:true, alg:'RSA-OAEP-2048+AES-GCM-256', key, iv, data}` (alles base64).
- Decrypt alleen met bijbehorende **private key**.

### Keypair-beheer (WebCrypto, JWK)
- Keypair aanmaken · keypair downloaden (`pdfhorse-keypair.json`) · public key downloaden
  (`pdfhorse-publickey.json`, te delen) · peer public key uploaden (versleutelen vóór ontvanger) ·
  eigen private key uploaden (ontsleutelen).
- Alles client-side; sleutels verlaten de browser alleen bij expliciete download.
- **WebCrypto vereist secure context (HTTPS)** — live op HC55/icthorse.nl OK.

### Wiring
- `app.js`: tab in `tabs`-array (na Delen), `advanced` state, handlers
  (`onAdvPdf*`/`onPayloadInput`/`genKeypair`/`download*`/`onPeerPublicUpload`/`onPrivateUpload`/
  `runEmbed`/`runExtract`/`advancedReset`).
- `index.html`: sectie met 3 modi (inbedden/uithalen/sleutels); `<script src="js/payload.js">`
  vóór `app.js`; header-versie → v0.20.0 — Wozencraft.
- `i18n.json`: 19 NL→EN entries.
- `version.json`: bump 0.20.0-Wozencraft.

## Verificatie
- `node --check` app.js + payload.js: OK. JSON valid: OK.
- **Crypto round-trip** in Node WebCrypto: encrypt→decrypt match ✓, verkeerde private key geweigerd ✓,
  AES-256-key past in RSA-2048-OAEP ✓.
- **pdf-lib attach** in Node: `/EmbeddedFiles` + `/Names` + attachment-naam aanwezig ✓ (default-save
  comprimeert in object-streams; geverifieerd met `useObjectStreams:false`).
- HTML-balans: 11 secties open/close, 9 tabs incl. `geavanceerd`.
- Browser-E2E (Playwright) NIET gedraaid (niet op HC55) — visuele bevestiging gebruiker gevraagd.

## Deploy
Dev-clone push origin → `/opt/pdfhorse` pull → rsync `frontend/` → `/var/www/pdfhorse/frontend/`.
Live: `https://horsecloud55.ddns.net/PDFHorse/`.
