# PDFHorse

> **iCt Horse dienst — browser-first PDF-bewerker met merge, split, OCR, invullen en ondertekenen.**
>
> Versie: **v0.0.1-Warnock** · Licentie: **AGPL-3.0** · Status: **skeleton (init)**

Live (gepland): https://icthorse.nl/PDFHorse/

## Wat doet PDFHorse?

Eén anonieme webpagina waar je een PDF opent, bewerkt en weer downloadt — zonder account, zonder permanente cloud-opslag.

| Functie | Locatie | Notitie |
|---|---|---|
| **Merge** — meerdere PDF's samenvoegen | client (pdf-lib) | Geen upload — alles in browser |
| **Split** — één PDF opdelen | client (pdf-lib) | Geen upload |
| **Invullen** — tekstvelden op PDF plaatsen | client (pdf-lib + canvas) | Geen AcroForm vereist |
| **Handtekening** — bitmap upload / SVG upload / live tekenen | client (signature_pad + Fabric.js) | 3 invoer-modi |
| **OCR** — gescande PDF → doorzoekbare PDF | server (Tesseract NL+EN) | Tijdelijke upload, direct gewist na render |
| **Output: download** | client | Standaard |
| **Output: print** | client | Browser-print-dialog |
| **Output: mail** | server (SMTP) | Vanaf `pdfservice@icthorse.nl` |

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
| v0.1.0 | **Geschke** | Charles Geschke, andere mede-oprichter Adobe |
| v1.0.0 | **Brotz** | Doug Brotz, mede-architect PostScript/PDF |

## Status

Dit is een **skeleton-init** repo. Geen code geschreven; alleen architectuur, vastlegging, licentie. Eerste runnable versie: v0.0.2 (zie `ACTIONS.md`).

## Ecosysteem

PDFHorse is **tooling SaaS** in het **iCt Horse** ecosysteem ([`Meta_iCt_Horse`](https://github.com/cpaglebbeek/Meta_iCt_Horse)) — naast SVGEditor en FreeSaasArchimate. Geen lid van het Diensten-sub-ecosysteem omdat er geen klant-sessies, auth of persistente data zijn (one-shot tooling).

Verwante tooling: [SVGEditor](https://github.com/cpaglebbeek/SVGEditor), [FreeSaasArchimate](https://github.com/cpaglebbeek/FreeSaasArchimate).
Verwante diensten (sub-ecosysteem Meta_iCt_Horse_Diensten): VeiligDelen, iCtHorseAssist, iCtHorseSupport, HorseSafe, iCtHorseAdmin.

## Licentie

[AGPL-3.0](LICENSE) — copyleft. Wijzigingen die als netwerk-dienst beschikbaar worden gemaakt moeten broncode publiceren.
