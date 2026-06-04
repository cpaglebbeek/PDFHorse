# PDFHorse

> **iCt Horse tooling SaaS — browser-first PDF-bewerker met merge, split, OCR, invullen en ondertekenen.**
>
> Versie: **v0.1.0-Geschke** · Licentie: **AGPL-3.0** · Status: **first feature live (client-side merge)**

Live (gepland): https://icthorse.nl/PDFHorse/

## Wat doet PDFHorse?

Eén anonieme webpagina waar je een PDF opent, bewerkt en weer downloadt — zonder account, zonder permanente cloud-opslag.

| Functie | Locatie | Status | Notitie |
|---|---|---|---|
| **Merge** — meerdere PDF's samenvoegen | client (pdf-lib) | ✅ v0.1.0-Geschke | Geen upload — alles in browser, drag-to-reorder |
| **Split** — één PDF opdelen | client (pdf-lib) | 🚧 v0.2.0 (gepland) | Geen upload |
| **Invullen** — tekstvelden op PDF plaatsen | client (pdf-lib + canvas) | 🚧 gepland | Geen AcroForm vereist |
| **Handtekening** — bitmap upload / SVG upload / live tekenen | client (signature_pad + Fabric.js) | 🚧 gepland | 3 invoer-modi |
| **OCR** — gescande PDF → doorzoekbare PDF | server (Tesseract NL+EN) | 🚧 wacht op mailbox+deploy | Tijdelijke upload, direct gewist na render |
| **Output: download** | client | ✅ (na merge) | Standaard |
| **Output: print** | client | 🚧 gepland | Browser-print-dialog |
| **Output: mail** | server (SMTP) | 🚧 wacht op mailbox | Vanaf `pdfservice@icthorse.nl` |

## Architectuur (kort)

- **Frontend:** Alpine.js + Tailwind + pdf-lib + signature_pad + Fabric.js (vanilla, geen build-pipeline)
- **Backend:** Python 3.12 + FastAPI (alleen OCR-endpoint + mail-endpoint)
- **OCR:** Tesseract 5 met `nld` + `eng` traineddata
- **Mail:** SMTP via Hostinger mailbox `pdfservice@icthorse.nl`
- **Hosting:** HC55 (Hetzner) `:3963` achter nginx, frontend gemount op `icthorse.nl/PDFHorse/`
- **State:** geen DB — sessie-state in browser; tijdelijke server-uploads in `/tmp/pdfhorse/<uuid>` direct gewist na response

Volledige architectuur, data-flow en componenten: zie [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Privacy

PDF's kunnen gevoelig zijn. PDFHorse minimaliseert exposure:
1. Merge/split/sign/fill draaien **volledig in browser** — geen upload.
2. OCR draait server-side (Tesseract heeft beeld nodig). Upload is **tijdelijk** (random uuid-dir, max 30 min), wordt **direct na response gewist**.
3. Geen account, geen logs van bestandsinhoud (alleen request-timing en groottes).
4. HTTPS-only (icthorse.nl).
5. Mail-functie verstuurt **alleen naar door gebruiker opgegeven adres** (geen archief, geen CC).

Zie `docs/PRIVACY.md` (TBD) voor volledig statement.

## Limieten

| Limiet | Waarde | Reden |
|---|---|---|
| Max upload per bestand | 50 MB | Tesseract-geheugen + browser-stabiliteit |
| Max upload per sessie | 100 MB | DoS-bescherming |
| Sessie-timeout | 30 min | Auto-cleanup |
| OCR-talen | NL + EN | Uitbreidbaar via Tesseract traineddata |

## Codenamen — thema "PDF-pioniers"

Versies krijgen namen van mensen die PDF (en Adobe) mogelijk maakten:

| Versie | Codenaam | Reden |
|---|---|---|
| v0.0.1 | **Warnock** | John Warnock, mede-uitvinder PostScript + PDF + mede-oprichter Adobe |
| v0.0.2 | **Warnock** | Runnable skelet (FastAPI + Alpine/Tailwind, 5 tabs, 4/4 pytest, deploy-artefacten) |
| **v0.1.0** | **Geschke** | **Charles Geschke, mede-oprichter Adobe — eerste werkende feature: client-side merge via pdf-lib** |
| v0.2.0 (gepland) | Wozencraft | Split-feature (page-ranges) |
| v1.0.0 (gepland) | Brotz | Doug Brotz, mede-architect PostScript/PDF |

## Status

**v0.1.0-Geschke (2026-06-04):** Eerste echte feature live — client-side merge via pdf-lib 1.17.1 (CDN), volledig in browser, geen upload. Drag-to-reorder, size-limits 50/100 MB, encrypted-PDF detect. Backend (FastAPI) ongewijzigd t.o.v. v0.0.2-Warnock. Tests: 4/4 pytest groen + Node smoke-test merge.

Volledige backlog en volgende stappen: zie [`ACTIONS.md`](ACTIONS.md).

## Ecosysteem

PDFHorse is **tooling SaaS** in het **iCt Horse** ecosysteem ([`Meta_iCt_Horse`](https://github.com/cpaglebbeek/Meta_iCt_Horse)) — naast SVGEditor en FreeSaasArchimate. Geen lid van het Diensten-sub-ecosysteem omdat er geen klant-sessies, auth of persistente data zijn (one-shot tooling).

Verwante tooling: [SVGEditor](https://github.com/cpaglebbeek/SVGEditor), [FreeSaasArchimate](https://github.com/cpaglebbeek/FreeSaasArchimate).
Verwante diensten (sub-ecosysteem Meta_iCt_Horse_Diensten): VeiligDelen, iCtHorseAssist, iCtHorseSupport, HorseSafe, iCtHorseAdmin.

## Licentie

[AGPL-3.0](LICENSE) — copyleft. Wijzigingen die als netwerk-dienst beschikbaar worden gemaakt moeten broncode publiceren.
