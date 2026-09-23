# PDFHorse — verschil as-is (code) ↔ to-be (ontwerp)

Gegenereerd door ModelArchDSL; niet met de hand bewerken.

| Status | Aantal |
|---|---:|
| Gebouwd | 26 |
| Deels gebouwd | 0 |
| Gepland (to-be) | 4 |
| Alleen in code | 2 |
| Niet traceerbaar | 0 |
| Extern (andere repo) | 6 |
| Ontwerp | 42 |

Feiten uit de code: 62, waarvan 6 niet in het ontwerp.

## Gepland — in het ontwerp, nog niet in de code

- `ac_pades` PAdES digitale handtekening (X.509)
- `ac_pwa` PWA / offline-modus (Service Worker)
- `nd_icthorse` icthorse.nl/PDFHorse/ (reverse-proxy via Hostinger)
- `ss_cleanup` Opruimjob /tmp/pdfhorse (ouder dan 30 min)

## Alleen in code — niet in het ontwerp

- `auto_api_api_anchor` Routes /api/anchor/* (1) (1 feiten)
- `auto_config` Configuratie (omgeving) (5) (5 feiten)
