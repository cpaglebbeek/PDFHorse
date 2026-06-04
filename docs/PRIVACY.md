# Privacyverklaring — PDFHorse

> Versie geldend per **v0.3.0-Putman**, 2026-06-04. Update bij elke wijziging die invloed heeft op gegevensverwerking.

## Korte versie (1 alinea)

PDFHorse bewerkt je PDFs **zoveel mogelijk in je eigen browser**: merge, split, invullen en ondertekenen verlaten je apparaat niet. Alleen OCR (gescande PDF doorzoekbaar maken) en mail-verzending vereisen onze server — die uploadt het bestand tijdelijk, verwerkt het, stuurt het resultaat terug en wist het direct. Geen account, geen cookies, geen tracking, geen archief.

## Verantwoordelijke

**iCt Horse** — Christian Glebbeek
Mail: `pdfservice@icthorse.nl`
Domein: `icthorse.nl/PDFHorse/`

## Welke gegevens worden verwerkt?

### Client-side (jouw browser, niet bij ons)
- **PDF-inhoud bij merge, split, invullen, ondertekenen** — blijft volledig in het werkgeheugen van je browser. Wij zien dit nooit.
- **Sessie-state** (welke files, welke ranges, welke handtekening) — alleen in browser-RAM, verdwijnt zodra je het tabblad sluit. Geen `localStorage`, geen `IndexedDB` met inhoud.

### Server-side (alleen bij DOCX-conversie, OCR en mail-verzending)
- **Office → PDF conversie (sinds v0.6.0-Paxton voor docx, sinds v0.7.0-Knuth ook xlsx)**: als je een `.docx` of `.xlsx`-bestand uploadt in de Merge- of Converteren-tab, wordt dit naar `/tmp/pdfhorse/<uuid>/in.<ext>` geschreven, geconverteerd via LibreOffice headless (`soffice --headless --convert-to pdf`) en het resultaat teruggestuurd. Daarna verwijdert een `BackgroundTask` de hele map (`shutil.rmtree`) — typisch binnen seconden na response. Een cleanup-job verwijdert sowieso elke map ouder dan 30 minuten. Geen inhouds-log; alleen aggregate metrics (bestandsgrootte, conversietijd) worden geteld.
- **PNG/JPG → PDF (sinds v0.7.0-Knuth)**: blijft **volledig in je browser** via pdf-lib. Geen server-upload.
- **OCR**: de geüploade PDF wordt opgeslagen in `/tmp/pdfhorse/<uuid>/in.pdf`, verwerkt door Tesseract (`ocrmypdf`), het resultaat wordt teruggestuurd en de hele tijdelijke map wordt **onmiddellijk in dezelfde request** verwijderd via `shutil.rmtree()`. Maximale opslagduur in praktijk: enkele seconden. Een cleanup-job verwijdert sowieso elke map ouder dan 30 minuten.
- **Mail**: het bestand wordt naar het door jou opgegeven recipient-adres gestuurd via `pdfservice@icthorse.nl`. Geen BCC, geen archief, geen kopie naar onszelf. De PDF wordt na verzending direct lokaal gewist.

### Niet verwerkt
- Geen accountgegevens (er is geen account)
- Geen IP-adressen voor identificatie (nginx `access_log off` voor `/PDFHorse/`)
- Geen cookies (behalve eventueel een nginx-noodzakelijke sessie-cookie, zonder inhoudsdata)
- Geen analytics, geen tracking-pixels
- Geen 3rd-party fonts (Google Fonts is privacy-gevoelig en wordt vermeden)

## Rechtsgrond

Voor zover er überhaupt persoonsgegevens kunnen worden afgeleid uit het gebruik (bv. een naam in een geüploade PDF):
- **Uitvoering van overeenkomst** (art. 6 lid 1 sub b AVG) — je gebruikt de tool om een PDF te bewerken.
- Geen profiling, geen geautomatiseerde besluitvorming.

## Bewaartermijn

| Verwerking | Bewaartermijn |
|---|---|
| Client-side (browser) | Tot je het tabblad sluit |
| DOCX-conversie op server | Enkele seconden (BackgroundTask `shutil.rmtree` direct na response), absolute max 30 minuten via cleanup |
| OCR-upload op server | Enkele seconden (single-request lifecycle), absolute max 30 minuten via cleanup |
| Mail-verzending | Geen retentie aan onze kant — alleen bij ontvangende mailserver |
| Logs | Geen content-logs. Aggregate request-metrics (aantal/grootte) maximaal 30 dagen voor abuse-detectie |

## Doorgifte

- **LibreOffice (DOCX → PDF)** draait lokaal op HorseCloud55 (Hetzner, EU/Duitsland). Geen externe API-call.
- **Tesseract OCR** draait lokaal op HorseCloud55 (Hetzner, EU/Duitsland). Geen externe API-call.
- **SMTP-mail** gaat via Hostinger SMTP (`smtp.hostinger.com`). Hostinger is verantwoordelijke voor mail-verzending; verwerkingsovereenkomst via hun standaard-voorwaarden.
- Geen doorgifte buiten de EU.

## Beveiliging

- HTTPS-only (nginx redirect).
- Tijdelijke uploads in random-uuid mappen, mode `700`, root-only.
- `.env` met SMTP-credentials mode `600`, root-only, niet in git.
- Rate-limiting via `slowapi` op OCR + mail endpoints (DoS-mitigatie).
- CSP-header beperkt scripts tot self + Tailwind/pdf-lib/Alpine CDN.
- Frontend dependencies via CDN met integriteits-hashes (SRI) — gepland v0.2.x, nog niet actief.

## Jouw rechten

Omdat er geen account is en geen persoonsgegevens persistent worden opgeslagen, zijn de meeste AVG-rechten niet relevant:
- **Recht op inzage / wissen**: niet van toepassing — wij hebben niets van jou opgeslagen.
- **Recht op overdraagbaarheid**: niet van toepassing — geen profiel of data om over te dragen.
- **Recht van bezwaar / klacht**: kun je indienen bij de [Autoriteit Persoonsgegevens](https://autoriteitpersoonsgegevens.nl/).

Voor vragen of incidenten: mail `pdfservice@icthorse.nl`.

## Open-source = auditable

PDFHorse is volledig open-source (AGPL-3.0, broncode: [GitHub](https://github.com/cpaglebbeek/PDFHorse)). Je kunt zelf verifiëren dat de hierboven beschreven gegevensverwerking klopt — niets gebeurt achter gesloten deuren.

## Wijzigingen aan deze verklaring

Versie-historie via [`CHANGELOG.md`](../CHANGELOG.md). Bij materiële wijzigingen wordt de versie hierboven bijgewerkt; de geldende verklaring is altijd de versie in de `main`-branch op `github.com/cpaglebbeek/PDFHorse`.
