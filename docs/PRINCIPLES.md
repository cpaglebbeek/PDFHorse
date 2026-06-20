# PRINCIPLES — PDFHorse

> Ontwerpprincipes met **waarom**. Bij elke architectuur-/feature-beslissing: toets aan deze principes; bij conflict eerst hier reconciliëren vóór code.

## P1 — Client-first

**Regel:** Elke PDF-operatie die zonder server kán, gebeurt in de browser.

**Waarom:** PDFs bevatten vaak gevoelige inhoud (contracten, medische data, financiën). Hoe minder de inhoud het apparaat van de gebruiker verlaat, hoe minder exposure. Server-side verwerking is alleen toegestaan waar het technisch onvermijdelijk is (OCR vereist Tesseract; mail vereist SMTP-server).

**Toepassing:** Merge, split, fill, sign, download, print → 100% client. OCR + mail → server, met striktst mogelijke isolatie (tijdelijke `/tmp/`, direct gewist, geen logging van inhoud).

**Conflict-test:** Als je overweegt iets server-side te doen — kan het ook via een browser-lib? Zo ja: client.

## P2 — CDN-only, geen build-pipeline

**Regel:** Frontend-dependencies via CDN (`cdn.tailwindcss.com`, `unpkg.com`). Géén npm, geen webpack/vite, geen `package.json` aan de frontend-kant.

**Waarom:** PDFHorse moet één enkel `index.html` zijn dat overal werkt — lokaal openen (`file://`), Hostinger-static, HC55-nginx. Geen build-pipeline = geen breukvlak tussen ontwikkelaars, geen versie-divergence tussen lokaal en productie, geen `node_modules` te onderhouden.

**Toepassing:** Tailwind utilities runtime, Alpine.js reactive binding, pdf-lib voor PDF read/write — allemaal via `<script src="https://unpkg.com/...">`.

**Conflict-test:** Als je een lib wil toevoegen die geen CDN-bundel heeft of een build-step vereist, moet je P2 overrulen. Verifieer eerst of er een browser-native alternatief is.

## P3 — Stateless server

**Regel:** Backend (FastAPI) heeft géén database, geen sessies, geen persistente state. Elke request is volledig zelfdragend; binnen 1 response volledig verwerkt en alle artefacten verwijderd.

**Waarom:** Geen DB = geen lek-risico, geen GDPR-bewaarverplichting, geen schema-migraties, geen backup-headache. Stateless = horizontaal schaalbaar en herstartbaar zonder dataverlies.

**Toepassing:** OCR-flow: upload → `/tmp/pdfhorse/<uuid>/in.pdf` → ocrmypdf → response → `shutil.rmtree(<uuid>)` in `finally`. Mail-flow: upload + adres → SMTP → response → unlink. Geen logging van inhoud (alleen request-timing + groottes voor metrics).

**Conflict-test:** Als een feature server-state vereist, eerst P1 + P3 reconciliëren: kan de state in de browser blijven?

## P4 — Geen account, geen tracking

**Regel:** Geen registratie, geen login, geen cookies (behalve strikt-noodzakelijke session-cookie als nginx dat per ongeluk zet — verifieer en disable), geen analytics, geen Google Fonts (privacy-tracking-vector).

**Waarom:** Anonimiteit is **het** onderscheidende kenmerk van PDFHorse t.o.v. commerciële tools (Adobe, Smallpdf, iLovePDF). Een gebruiker die snel een PDF wil mergen wil niet eerst inschrijven, niet getrackt worden, niet zijn naam aan een tool koppelen.

**Toepassing:** nginx `access_log off` voor `/PDFHorse/`. Geen 3rd-party scripts behalve de uitdrukkelijk vereiste CDN-libs (Tailwind, Alpine, pdf-lib). Tailwind via CDN serveert geen Google Fonts in default.

**Conflict-test:** Als een feature personalisatie vereist (bv. "onthoud mijn handtekening"): kan het in `localStorage` (lokaal-only), niet in een server-account?

## P5 — Mail-only, geen archief

**Regel:** Als de gebruiker een PDF per mail laat versturen via `pdfservice@icthorse.nl`, gaat hij ALLEEN naar het opgegeven recipient-adres. Geen BCC-self, geen kopie naar systeem-archief, geen log van de inhoud.

**Waarom:** P4 (anonimiteit) impliceert dat het systeem ook niet stiekem mee mag lezen. Een BCC-archief is een sneaky vorm van tracking. De gebruiker moet de tool zonder zorgen kunnen gebruiken voor vertrouwelijke documenten.

**Toepassing:** Backend `mail`-endpoint logt alleen `{from: pdfservice@icthorse.nl, to: <recipient>, subject: <user>, timestamp}` — niet de inhoud, niet de PDF-bytes. SMTP-response gewist na verzending.

**Conflict-test:** Als je een mail-feature toevoegt en zou willen tracken voor delivery-confirmation: kan dat in de SMTP-response zelf (sync) i.p.v. een eigen log?

## P6 — AGPL-3.0 copyleft

**Regel:** Broncode altijd publiek. Wijzigingen die als netwerk-dienst beschikbaar gemaakt worden moeten broncode publiceren. Geen closed-source forks.

**Waarom:** Anonimiteit + privacy zijn alleen geloofwaardig als de code openbaar en auditable is. AGPL beschermt tegen "wij hebben jouw tool overgenomen en er een eigen commerciële spy-versie van gemaakt"-scenario's. Plus: ideologische pas bij iCt Horse public-tooling lijn.

**Toepassing:** `LICENSE` AGPL-3.0 in repo-root. Header in `index.html` linkt naar broncode. `README.md` benoemt copyleft expliciet. Bij contributie: contributors implicit consent op AGPL.

**Conflict-test:** Als iemand wil forken voor commercieel gebruik moet hun fork ook AGPL blijven. Geen MIT/BSD downgrade.

## P7 — Limieten als deel van het ontwerp

**Regel:** Harde limieten staan in de code (`MAX_FILE_BYTES`, `MAX_SESSION_BYTES`, `SESSION_TIMEOUT_S`) én worden client + server consistent toegepast. Limieten kunnen niet door config-flags omzeild worden.

**Waarom:** Zonder limieten is een gratis anonieme PDF-tool een DoS-doelwit. Limieten beschermen de service voor alle gebruikers. Consistent toepassen = geen verschil tussen browser-melding en server-rejection (frustratie-vermijding).

**Toepassing:** Frontend `MAX_FILE_BYTES = 50*1024*1024`, backend `MAX_UPLOAD_SIZE_BYTES = 52428800`, nginx `client_max_body_size 55m`. Alle drie gelinkt aan dezelfde "50 MB"-belofte naar de gebruiker.

**Conflict-test:** Als een gebruiker een groter bestand wil verwerken: stuur ze naar lokale tools (PDFHorse zelf via `file://` open kan ook grotere files aan), niet naar een config-toggle.

## P8 — Documentatie is onderdeel van de feature

**Regel:** Een feature is pas "klaar" als `ARCHITECTURE.md`, `docs/DEPENDENCIES.md`, en (waar van toepassing) `docs/DESIGN_TOKENS.md` + `CHANGELOG.md` mee-bijgewerkt zijn.

**Waarom:** Aansluitend op `Meta_Master/CLAUDE.md` Expliciete Vastlegging Principe. Code zonder vastlegging is een black box voor de volgende sessie of agent. Vastlegging is geen "later"-werk, het is een definitie van done.

**Toepassing:** PR-template / commit-checklist bevat docs-update als verplicht item. Bij sanitycheck-audit telt ontbrekende docs als 🟠/❌.

**Conflict-test:** Als tijd-pressure suggereert docs over te slaan: zet een TODO-comment in de feature + open ACTIONS-entry, niet "ik maak het later af" zonder spoor.

## P-PoA-01 — Verdict via gemiddelde score over meest tolerante pHash-laag per pagina

**Regel:** Een PoA-verify-uitslag is een gemiddelde van per-pagina scores, waarbij elke pagina-score = `max(score_avg, score_dct, score_dhash)`. Drempels: `≥ 0.98 → IDENTICAL`, `≥ 0.85 → LAYOUT_MATCH`, `≥ 0.75 → PROBABLE`, `< 0.75 → NO_MATCH`.

**Waarom:** Eén pHash-laag (zoals het v0.22 8×8 avg-hash) is óf te ruw (screenshot-attack overleeft) óf te streng (cosmetische edits worden geweigerd). Drie complementaire lagen vangen verschillende edit-typen op:
- **8×8 avg** — robuust voor lichte luminantie-shifts; backwards compat met v0.22 PoA-PDFs.
- **16×16 dCT** — robuust voor recompressie, kleur-shifts, lichte filtering; gebruikt low-freq energie.
- **16×16 dHash** — robuust voor uniforme helderheids-verschuivingen; vangt gradient-patronen op die dCT mist.

De **meest tolerante laag** mag winnen per pagina, omdat een visueel-equivalente edit hoeft maar door één laag herkend te worden. Het **gemiddelde** over pagina's voorkomt dat één outlier-pagina (bv. blanco achterkant) de hele PDF kapot-scort.

De drempels komen uit PhotoVerify v8.3 (`Meta_PhotoVerify/src/utils/perceptualHash.ts`), waar ze in productie zijn afgesteld voor JPEG-screenshots van originelen.

**Toepassing:** `frontend/js/hash.js` levert `compareHashesElastic()` met 5×5 X/Y-shift-search (port van PhotoVerify). `frontend/js/app.js#runVerify()` berekent per pagina alle beschikbare lagen, kiest `max()`, gemiddeld over pagina's, mapt op verdict. `frontend/index.html` toont score als percentage + verdict-badge + uitleg-zin.

**Conflict-test:** Als een vierde pHash-laag wordt toegevoegd: blijft de "max wint per pagina"-regel, geen herweging — anders moeten alle drempels opnieuw gecalibreerd. Als drempels gewijzigd worden: dit principe updaten + minimaal smoke-test op een gerefereerde set PoA-PDFs (identiek, watermerk-versie, gerecomprimeerd, gecropped, geheel ander document).

## P-PoA-02 — Twee rapport-typen: claim (sign-time) en match (verify-time)

**Regel:** Een PoA-rapport heeft één van **twee** rollen, expliciet onderscheiden in de UI én in de PDF-titel:
- **Claim-rapport** — uitgegeven door `runHash()`. Bewijst de **claim van eerste eigendom**: koppelt owner + bron-bestand + hashes + OTS-anchor aan een tijdstip. Verdict-box is groen: "CLAIM OF FIRST OWNERSHIP".
- **Match-rapport** — uitgegeven door `runVerify()`. Bewijst de **overeenkomst** tussen een ingeleverde PDF en een embedded claim met een **verdict-%** (gekleurd: IDENTICAL/LAYOUT_MATCH groen, PROBABLE oranje, NO_MATCH rood). Toont per-laag/per-pagina evidence-comparison.

**Waarom:** Eén rapport-type met "alles erin" mengt twee fundamenteel verschillende beweringen:
1. *"Ik claim dat ik dit op tijd T heb gemaakt"* (sign-time, single-party, gericht aan toekomstige verifiers).
2. *"Deze PDF die ik nu in mijn hand heb komt visueel/conceptueel overeen met die claim"* (verify-time, two-party, gericht aan de partij die het ontvangt).

Een rechter, accountant of journalist die kijkt naar een PoA-PDF moet meteen kunnen zien welke vraag dit rapport beantwoordt — claim of match. Aparte rapport-typen met verschillend verdict-kleur (claim altijd groen-OK, match in 4 klassen) maken die functie visueel onomstreden. PhotoVerify hanteert dezelfde split (sign vs verify), en de patronen daar zijn in productie afgesteld.

**Toepassing:** `frontend/js/poa-report.js#buildClaimV2(meta)` en `buildMatchReport(meta, verifyResult, currentFileInfo)`. Renderer-helper `verdictBox(verdict, scorePct, title, subtitle)` met expliciete kleur-mapping per verdict-klasse. Twee pagina's per rapport: p1 verdict + context, p2 evidence-detail. WinAnsi-safe via `_ascii()`. `frontend/js/app.js#runHash()` schrijft het claim-rapport in de PDF-bijlage `pdfhorse-poa.pdf` én in `hashing.poaBytes` voor losse download. `runVerify()` produceert `hashing.matchReportBytes` voor download via knop "Match-rapport (PDF)".

**Conflict-test:** Een nieuw rapport-type toevoegen (bv. "audit-rapport" voor 3-partij scenario's) → eerst nadenken: is dit een derde fundamentele bewering, of een variant op claim/match? Variant → optie van bestaande type. Echt nieuwe bewering → nieuw type met eigen verdict-semantiek.

## Versiehistorie

| Versie | Wijziging |
|---|---|
| v0.0.1-Warnock | Principes verspreid in CLAUDE.md + ARCHITECTURE.md, niet als eigen doc |
| v0.3.0-Putman | **`docs/PRINCIPLES.md` aangemaakt** met 8 principes P1-P8 |
| v0.23.0-Diffie | **P-PoA-01 toegevoegd** — verdict-formule en drempels voor multi-layer pHash verify |
| v0.24.0-Rivest | **P-PoA-02 toegevoegd** — claim-rapport (sign-time) vs match-rapport (verify-time) met aparte verdict-semantiek |
