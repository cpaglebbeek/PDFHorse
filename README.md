# PDFHorse

> **iCt Horse tooling SaaS — browser-first PDF-bewerker met merge, split, invullen, ondertekenen, converteren (docx/xlsx/odt/rtf/png/jpg), OCR (NL+EN) en mail.**
>
> Versie: **v0.9.1-Mittelbach** · Licentie: **AGPL-3.0** · Status: **alle 8 features LIVE + SRI-gehard**

🚀 **LIVE op https://horsecloud55.ddns.net/PDFHorse/** (sinds 2026-06-04)
Gepland (Hostinger reverse-proxy): https://icthorse.nl/PDFHorse/

## Wat doet PDFHorse?

Eén anonieme webpagina waar je PDF's (en Word- / Excel-documenten / afbeeldingen) bewerkt en downloadt — zonder account, zonder permanente cloud-opslag.

| Functie | Locatie | Status | Notitie |
|---|---|---|---|
| **Merge** — meerdere PDF's én .docx samenvoegen | client (pdf-lib) + server (LibreOffice voor docx) | ✅ v0.1.0-Geschke + v0.6.0-Paxton | Drag-to-reorder, kleur-badges PDF/DOCX, encrypted-detect |
| **Split** — één PDF opdelen op page-ranges | client (pdf-lib) | ✅ v0.2.0-Wozencraft | Range-syntax `1-3, 5, 8-10` → N losse PDFs |
| **Invullen** — tekstvelden vrij plaatsen op PDF | client (pdf-lib + PDF.js) | ✅ v0.3.0-Putman | Klik op pagina → tekst → coords-transform |
| **Ondertekenen** — bitmap upload / SVG upload / live tekenen | client (signature_pad + pdf-lib) | ✅ v0.4.0-Taft | 3 modi (A bitmap / B SVG / C live-canvas wit→transparant) |
| **Converteren** — .docx / .xlsx / .odt / .rtf / .png / .jpg → PDF | server (LibreOffice voor office) + client (pdf-lib voor images) | ✅ v0.7.0-Knuth + v0.9.1-Mittelbach (odt/rtf) | Batch + toggle "Combineer alle tot 1 PDF" |
| **Output-bar** — Download / Print / Mail laatste output | client (Print via hidden iframe) + server (Mail via SMTP) | ✅ v0.5.0-Crocker + v0.9.0-Lamport | Persistent per tab |
| **OCR** — gescande PDF → doorzoekbare PDF | server (Tesseract NL+EN via ocrmypdf) | ✅ v0.8.0-Reid | Idempotent (`--skip-text`); 30s–3min |
| **Mail-verzending** | server (Hostinger SMTP, `PDFHorse <info@icthorse.nl>` als from + reply-to) | ✅ v0.9.0-Lamport | PDF-attachment max 5 MB, rate-limit 5/uur/IP |

## Architectuur (kort)

- **Frontend:** Alpine.js + Tailwind + pdf-lib 1.17.1 + PDF.js 4.0.379 + signature_pad 5.0.4 (CDN-only, geen build)
- **Backend:** Python 3.12 + FastAPI op `:3963`
- **Office-conversie (docx/xlsx → PDF):** LibreOffice 24.2.7 headless (`soffice --headless --convert-to pdf`)
- **OCR:** Tesseract 5 + ocrmypdf, `nld+eng` traineddata
- **Mail:** Hostinger SMTP (`smtp.hostinger.com:587` STARTTLS), Facturatie-stijl hergebruik — `info@icthorse.nl` als SMTP-auth én From-mailbox (display-name "PDFHorse"); Reply-To = `info@icthorse.nl`. Geen aparte Hostinger-mailbox nodig.
- **Hosting:** HC55 (Hetzner, EU/Duitsland) achter nginx, frontend op `/var/www/pdfhorse/`
- **State:** geen DB — sessie-state in browser; tijdelijke server-uploads in `/tmp/pdfhorse/<uuid>` direct gewist via `BackgroundTask shutil.rmtree`

Volledige architectuur, data-flow en componenten: zie [`ARCHITECTURE.md`](ARCHITECTURE.md). Principes: [`docs/PRINCIPLES.md`](docs/PRINCIPLES.md). Dependencies: [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md).

## Privacy

PDF's en documenten kunnen gevoelig zijn. PDFHorse minimaliseert exposure:
1. **Merge/split/sign/fill draaien volledig in browser** — geen upload.
2. **PNG/JPG → PDF** ook volledig client-side.
3. **DOCX/XLSX → PDF** vereist server-conversie via LibreOffice; upload is **tijdelijk** in `/tmp/pdfhorse/<uuid>/`, **direct gewist** via `BackgroundTask shutil.rmtree`.
4. OCR (gepland) volgt hetzelfde patroon als docx/xlsx-conversie.
5. Geen account, geen logs van bestandsinhoud (alleen aggregate request-metrics).
6. HTTPS-only (Let's Encrypt cert op horsecloud55.ddns.net).
7. Mail-functie verstuurt alleen naar opgegeven adres — geen BCC, geen archief (rate-limit 5/uur/IP, attachment max 5 MB).

Volledige verklaring: [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Limieten

| Limiet | Waarde | Reden |
|---|---|---|
| Max PDF upload per bestand | 50 MB | Browser-stabiliteit |
| Max docx / xlsx per bestand | 20 MB | LibreOffice RAM-budget |
| Max PNG/JPG per bestand | 50 MB | Browser-stabiliteit |
| Max upload per sessie | 100 MB | DoS-bescherming |
| Sessie-timeout (server-cleanup) | 30 min | Auto-cleanup `/tmp/pdfhorse/<uuid>/` |
| LibreOffice timeout per conversie | 60 s | Veiligheidsnet |
| OCR-talen | NL + EN | Uitbreidbaar via Tesseract traineddata |
| OCR-timeout | 180 s | Tesseract per-page-budget |
| Mail PDF-attachment | 5 MB | Hostinger SMTP-limiet |
| Mail rate-limit | 5/uur/IP | DoS-mitigatie (in-process bucket) |

## Codenamen — thema "PDF-pioniers"

| Versie | Codenaam | Reden |
|---|---|---|
| v0.0.1 / v0.0.2 | **Warnock** | John Warnock, mede-uitvinder PostScript + PDF, mede-oprichter Adobe — init + skelet |
| v0.1.0 | **Geschke** | Charles Geschke, mede-oprichter Adobe — client-side merge |
| v0.2.0 | **Wozencraft** | Lawrence Wozencraft, Adobe PostScript engineer — client-side split |
| v0.3.0 | **Putman** | Robert Putman, PostScript-graphics architect — client-side fill |
| v0.4.0 | **Taft** | Bill Taft, Adobe PostScript Level 2 + PDF-architectuur — client-side sign (3 modi) |
| v0.5.0 | **Crocker** | Steve Crocker, ARPANET RFC 1-auteur — output-bar (Download/Print/Mail "naar buiten") — afwijking van Adobe-traditie |
| v0.6.0 | **Paxton** | Bill Paxton, Adobe Type Manager / PostScript Type 1 architect — docx-merge via LibreOffice |
| v0.7.0 | **Knuth** | Donald Knuth, TeX-pionier (1978) — document-typografie voor Convert-tab |
| v0.8.0 | **Reid** | Brian Reid, Scribe markup (1980) — OCR / tekst-herkenning |
| v0.9.0 | **Lamport** | Leslie Lamport, LaTeX (1984) — document-distributie (mail) |
| v0.9.1 | **Mittelbach** | Frank Mittelbach, LaTeX3-team-lead (1990–) — kwaliteits-borging + format-uitbreiding (SRI + odt/rtf) |
| v1.0.0 (gepland) | **Brotz** | Doug Brotz, mede-architect PostScript/PDF — major-release reserve |

## Status

**v0.9.0-Lamport (2026-06-14):** alle 8 features LIVE op HC55. Merge/Split/Fill/Sign/Output-bar volledig client-side; Convert-tab routeert per type (office → server LibreOffice, image → client pdf-lib); docx-support sinds v0.6.0-Paxton ook in Merge; OCR (v0.8.0-Reid) via Tesseract+ocrmypdf; **Mail (v0.9.0-Lamport) via Hostinger SMTP** met alias `pdfservice@icthorse.nl` zonder mailbox-aanmaak — hergebruik `info@icthorse.nl`-creds van Facturatie. Backend FastAPI met `/api/health` + `/api/limits` + `/api/convert/docx-to-pdf` + `/api/convert/xlsx-to-pdf` + `/api/ocr` + `/api/mail` allemaal LIVE.

**Tests:** pytest 17/17 groen + 6 Node smokes (merge/split/fill/sign/docx/xlsx).

Volledige changelog: [`CHANGELOG.md`](CHANGELOG.md) — backlog: [`ACTIONS.md`](ACTIONS.md) — bekende bugs: [`docs/BUGLIST.md`](docs/BUGLIST.md).

## Ecosysteem

PDFHorse is **tooling SaaS** in het **iCt Horse** ecosysteem ([`Meta_iCt_Horse`](https://github.com/cpaglebbeek/Meta_iCt_Horse)) — naast SVGEditor en FreeSaasArchimate. Geen lid van het Diensten-sub-ecosysteem omdat er geen klant-sessies, auth of persistente data zijn (one-shot tooling).

Verwante tooling: [SVGEditor](https://github.com/cpaglebbeek/SVGEditor), [FreeSaasArchimate](https://github.com/cpaglebbeek/FreeSaasArchimate).
Verwante diensten (sub-ecosysteem Meta_iCt_Horse_Diensten): VeiligDelen, iCtHorseAssist, iCtHorseSupport, HorseSafe, iCtHorseAdmin.

## Licentie

[AGPL-3.0](LICENSE) — copyleft. Wijzigingen die als netwerk-dienst beschikbaar worden gemaakt moeten broncode publiceren.
