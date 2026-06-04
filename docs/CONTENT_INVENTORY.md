# CONTENT_INVENTORY — PDFHorse

> Per tab: **doel**, **doelgroep**, **key-message** en **CTA** (call-to-action).
> Sluit de Logisch-Functioneel + Inhoudelijk gaten uit `/sanitycheck` v0.7.0-Knuth.
> Bronnen: `frontend/index.html` (teksten letterlijk), `ARCHITECTURE.md` (data-flows), `README.md` (status-tabel).

## Algemene boodschap (header + hero)

| Aspect | Inhoud |
|---|---|
| Header-naam | "PDFHorse" + versie-label (bv. `v0.7.0 — Knuth`) |
| Hero-zin | "Bewerk een PDF — zonder upload, zonder account" |
| Sub-zin | "Merge, split, invullen en ondertekenen draaien volledig in je browser. OCR en mailen gebeuren server-zijde en worden direct na bewerking gewist." |
| Doelgroep (overall) | Iemand die snel één PDF wil bewerken zonder zich te registreren en zonder een commerciële tool (Smallpdf/iLovePDF/Adobe) te willen vertrouwen met zijn document. Anoniem & privacy-first. |

## Tab 1 — Merge

| Aspect | Inhoud |
|---|---|
| **Doel** | Meerdere PDF's en/of Word-documenten samenvoegen tot één PDF |
| **Doelgroep** | Iemand die contracten/offertes/rapporten aan elkaar wil plakken; ook met losse Word-bijlagen |
| **Key-message** | "Sleep meerdere PDF's of Word-documenten (.docx) hierheen. PDF's worden volledig in je browser samengevoegd. .docx wordt eerst server-zijde naar PDF geconverteerd (tijdelijk, direct gewist)." |
| **CTA primair** | Knop **"Samenvoegen (N)"** |
| **CTA secundair** | "Wissen" (lijst reset) |
| **Limieten** | 50 MB per PDF · 20 MB per docx · 100 MB sessietotaal |
| **Edge-cases zichtbaar** | Drag-to-reorder ↑/↓/✕; kleur-badges PDF (grijs) / DOCX (blauw); progress "Converteert docx X/N…" |

## Tab 2 — Split

| Aspect | Inhoud |
|---|---|
| **Doel** | Eén PDF opdelen in N losse PDF's op basis van page-ranges |
| **Doelgroep** | Iemand die een groot rapport in hoofdstukken wil delen of pagina's wil uitlichten |
| **Key-message** | "Sleep één PDF hierheen, geef page-ranges op (bv. `1-3, 5, 8-10`) en download per range een eigen PDF. Alles in je browser — geen upload." |
| **CTA primair** | Knop **"Splitsen (N PDF's)"** |
| **CTA secundair** | "Wissen" |
| **Limieten** | 50 MB per PDF · ranges binnen 1..pageCount, geen achteruit-bereiken |
| **Edge-cases zichtbaar** | Live-validatie + visuele lijst van geparste ranges; 200ms delay tussen N downloads (popup-blocker-mitigation) |

## Tab 3 — Invullen

| Aspect | Inhoud |
|---|---|
| **Doel** | Vrije tekstvelden plaatsen bovenop een PDF zonder dat er AcroForm-velden hoeven te bestaan |
| **Doelgroep** | Iemand die een gescand contract of formulier zonder invul-veldjes alsnog digitaal wil ondertekenen / invullen |
| **Key-message** | "Upload een PDF, klik op een pagina om een tekstveld te plaatsen, type je tekst, en download de invulde PDF. Volledig in je browser — geen upload." |
| **CTA primair** | Knop **"Download invulde PDF (N veld(en))"** |
| **CTA secundair** | "Wissen"; ✕ per veld; lettergrootte-input |
| **Limieten** | 50 MB per PDF; canvas-coords → PDF-coords transform per page |
| **Edge-cases zichtbaar** | Per page renderen via PDF.js; live-edit Alpine x-model; encrypted-PDF foutmelding |

## Tab 4 — Ondertekenen

| Aspect | Inhoud |
|---|---|
| **Doel** | Handtekening invoegen op één of meerdere plekken in een PDF |
| **Doelgroep** | Iemand die digitaal moet tekenen zonder DocuSign/Adobe Sign-account |
| **Key-message** | "Upload een PDF, kies een manier om je handtekening aan te leveren, en klik op de pagina om hem te plaatsen. Volledig in je browser — geen upload." |
| **CTA primair** | Knop **"Download ondertekende PDF (N handtekening(en))"** |
| **CTA secundair** | "Wissen"; ✕ per plaatsing; "Wis handtekening"; "Wis" (signature_pad-stroke); breedte-slider |
| **Limieten** | 50 MB PDF · 10 MB bitmap · 2 MB SVG |
| **Bron-modi (sub-CTA)** | A — bitmap upload (PNG/JPG); B — SVG upload (script-tags gestript); C — live tekenen (signature_pad + wit→transparant) |
| **Edge-cases zichtbaar** | "Gebruik deze handtekening"-bevestiging in modus C; preview na keuze; aspect-ratio behouden bij plaatsing |

## Tab 5 — Converteren

| Aspect | Inhoud |
|---|---|
| **Doel** | Batch-conversie van Office-documenten en afbeeldingen naar PDF, optioneel gebundeld |
| **Doelgroep** | Iemand die een offerte (docx) + een prijslijst (xlsx) + een product-foto (png/jpg) in één PDF wil sturen |
| **Key-message** | "Sleep .docx / .xlsx / .png / .jpg-bestanden hierheen. Standaard krijg je per bestand een eigen PDF; vink Combineer aan om alles te bundelen tot één PDF. Office-bestanden gaan kort naar de server voor LibreOffice-conversie (direct gewist); afbeeldingen blijven in je browser." |
| **CTA primair** | Knop **"Converteer (N PDF's)"** óf **"Combineer naar 1 PDF"** (afhankelijk van toggle) |
| **CTA secundair** | "Wissen"; ✕ per file; ↑/↓ reorder; checkbox "Combineer alle tot 1 PDF" |
| **Limieten** | 20 MB per docx/xlsx · 50 MB per afbeelding |
| **Edge-cases zichtbaar** | Kleur-badges DOCX (blauw) / XLSX (emerald) / PNG/JPG (amber); progress "Converteert i/N: bestandsnaam" |

## Tab 6 — OCR (placeholder, gepland v0.8.0)

| Aspect | Inhoud |
|---|---|
| **Doel** | Een gescande (niet-doorzoekbare) PDF doorzoekbaar maken via Tesseract NL+EN |
| **Doelgroep** | Iemand met PDF-scans van contracten/facturen die hij wil archiveren of full-text doorzoeken |
| **Key-message** | "Talen: Nederlands + Engels. Server-zijde, upload wordt direct na verwerking gewist." |
| **CTA primair** | (gepland) **"Doorzoekbaar maken"** |
| **Status nu** | UI-skelet; `POST /api/ocr` levert 501-stub tot Tesseract install |

## Output-bar (onderaan elke tab, persistent)

| Aspect | Inhoud |
|---|---|
| **Doel** | Laatste output opnieuw toegankelijk maken zonder de feature opnieuw te runnen |
| **Doelgroep** | Iedereen die de output net heeft gegenereerd; tab-overstijgend |
| **Key-message** | "Laatste uitvoer: `<filename>` — `<feature>` (`<grootte>`)" |
| **CTA's** | **Download** (re-trigger) · **Print** (hidden iframe + browser-print) · **Mail…** (uitklap-form: ontvanger + onderwerp → `Verstuur`) |
| **Mail-status nu** | Backend levert 501-stub tot Hostinger mailbox `pdfservice@icthorse.nl` actief is — frontend toont nette "Mail-endpoint nog niet actief"-melding |

## Footer (alle tabs)

| Aspect | Inhoud |
|---|---|
| **Boodschap** | "PDFHorse — anonieme PDF-bewerker · AGPL-3.0 · [broncode]" + "Privacy-first: geen account, geen logs van inhoud, OCR-uploads ≤ 30 min." |
| **CTA** | Link naar GitHub broncode |

## Versiehistorie deze inventarisatie

| Versie | Wijziging |
|---|---|
| v0.7.0-Knuth | **`docs/CONTENT_INVENTORY.md` aangemaakt** — sluit Logisch-Functioneel + Inhoudelijk gaten uit /sanitycheck |
