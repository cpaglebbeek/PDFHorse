---
date: 2026-06-20
repo: PDFHorse
status: closed
resume: ""
---

# Sessie 2026-06-20 — PDFHorse v0.25.0-Shamir OpenPGP identity binding

**Agent:** Claude Opus 4.7 (1M context)
**Repo:** PDFHorse (`cpaglebbeek/PDFHorse`)
**Branche:** main
**Cross-repo werk:** Geen — patroon-inspiratie uit OpenPGP-best-practices (RFC4880, RFC8785-light canonical).
**Eindstand commits:** één commit "PDFHorse v0.25.0-Shamir — OpenPGP identity binding (Ed25519 sig over canonical envelope)".

## Doel

ROOD update (meta-implicaties): owner-info in de PoA-envelope is voor v0.25 self-rapportage. Een ander kan dezelfde tekst onder een eigen PDF zetten en even hard "ik ben de eigenaar" roepen. Met OpenPGP detached signature over canonical envelope-JSON, met de publieke sleutel embedded in de envelope, wordt het self-contained verifieerbaar identity-bewijs.

## Scope-keuze (besloten vóór aanvang)

- **IN scope:** OpenPGP.js (CDN, SRI-pinned) browser-side keygen/import + detached sig + embedded pubkey + verify-pad + match-rapport extension.
- **OUT scope:** git/HC55 registry — geparkeerd als losse iCt Horse dienst voorstel in `docs/PoARegistry-proposal.md`.

## Wat is gedaan

### `frontend/js/identity.js` (NIEUW, ~200 LoC)
`window.PDFHorseIdentity` met `generateKey` (Ed25519), `importKey`, pure `canonicalize` (sorted-keys + signature-strip + UTF-8 bytes), `signEnvelope`, `verifyEnvelope`, `formatFingerprint`.

### `frontend/index.html`
- OpenPGP.js 5.11.2 CDN-script met SRI `sha384-GSfnO+LcQAKSCm1NYG2u/acMR+jBE5ML42eWq3lKjR0Dglq3Zp4dWI3K319/7zmD` + crossorigin=anonymous.
- Script-tag voor `js/identity.js`.
- Sign-modus accordion "🔑 Identity binding" met 3 radio-modi (none/generate/import) + force-download-knop + fingerprint-display.
- Verify-paneel Identity-rij met groene OK / rode error / grijze "niet geclaimd".

### `frontend/js/app.js`
- State `hashing.identity` met 10 velden.
- Handlers: `identityGenerateAndDownload` (force-download → downloaded=true), `identityImportFile`, `identityParseImported`, `identityShortFingerprint`, `identitySignReady` (sign-gate), `identityToggle`.
- `runHash()` bumpt schema → poa-v3, zet `meta.signature`, wist passphrase + private key armored direct na sign.
- `runVerify()` checkt `meta.signature`, roept `Id.verifyEnvelope`, vult `verifyResult.identity = { present, valid, fingerprint, signed_at, error? }`. Strip `meta.pdfhorse` wrapper-key vóór canonical re-compute.
- Verdict-downgrade naar NO_MATCH bij `present && !valid`.

### `frontend/js/poa-report.js`
- `buildClaimV2` krijgt Identity-binding sectie op pagina 1.
- `buildMatchReport` krijgt Identity-sectie met tabel + uitleg-zinnen + waarschuwing bij ongeldige sig.
- Engine VERSION 0.2.0 → 0.3.0.

### `frontend/i18n.json`
18 nieuwe NL→EN entries.

### `backend/tests/test_identity.py` (NIEUW)
19 regex-structuurtests + `test_poa_report_v2.py` aangepast (VERSION 0.2.0 → 0.3.0).

### `scripts/test_identity_roundtrip.js` (NIEUW)
5 structuur-tests + 6 runtime-tests (skipt elegant zonder openpgp npm-dep).

### `version.json` + `CHANGELOG.md` + `docs/PRINCIPLES.md` + `docs/PoARegistry-proposal.md`
- version → 0.25.0, codenaam Shamir.
- CHANGELOG met verplichte **Security Audit-sectie** (threats addressed, NOT addressed, crypto-keuzes, memory hygiëne, verified, openstaand).
- P-PoA-03 toegevoegd aan PRINCIPLES.md.
- PoARegistry-proposal: voorstel voor losse iCt Horse dienst.

## Test-resultaten

- Backend pytest: 63/63 groen (44 oud + 19 nieuw + `test_poa_report_v2` VERSION-test aangepast).
- Node `scripts/test_identity_roundtrip.js`: structuur-tests groen, runtime SKIP (geen npm openpgp-dep beschikbaar — conform precedent v0.24).
- SRI van openpgp@5.11.2: `sha384-GSfnO+LcQAKSCm1NYG2u/acMR+jBE5ML42eWq3lKjR0Dglq3Zp4dWI3K319/7zmD` (zelf berekend via curl + openssl dgst).

## Geen deploy

HC55 deploy + UI-screenshot expliciet uit-scope, in volgende sessie.

## Open

- HC55 deploy + UI-screenshot.
- PoARegistry-dienst — evaluatie in `Meta_iCt_Horse_Diensten`.
- Revocation-pad — afhankelijk van PoARegistry-beslissing.
