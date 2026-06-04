# docs/screens/ — Visuele referentie PDFHorse

> Per tab en per relevante UI-state een screenshot vanaf de LIVE URL `https://horsecloud55.ddns.net/PDFHorse/`.
> Sluit het Fysiek-Functioneel gat uit `/sanitycheck` v0.7.0-Knuth.

## Status

Screenshots worden **handmatig** door de gebruiker gegenereerd vanaf de live URL.
Deze map fungeert als plek waar ze gecommit worden. Alleen placeholder-README nu.

## Conventie voor bestandsnamen

```
docs/screens/<vXYZ>_<tab>_<state>.png
```

| Voorbeeld | Wat |
|---|---|
| `v070_merge_dropzone.png` | Merge-tab, lege drop-zone |
| `v070_merge_pdf_docx_list.png` | Merge-tab, lijst met PDF + DOCX en kleur-badges |
| `v070_split_ranges_parsed.png` | Split-tab met range-input en geparste-ranges-lijst |
| `v070_fill_canvas_clicked.png` | Fill-tab met 1 tekstveld geplaatst |
| `v070_sign_mode_c_drawn.png` | Sign-tab modus C, getekende handtekening + preview |
| `v070_convert_combine_toggle.png` | Convert-tab met combine-toggle aan + mixed types |
| `v070_output_bar_after_merge.png` | Output-bar na merge met mail-form open |
| `v070_full_overview.png` | Header + alle 6 tabs zichtbaar in nav |

## Per-tab checklist (volgens CONTENT_INVENTORY.md)

- [ ] **Merge** — drop-zone leeg, lijst met mix PDF+DOCX, "Samenvoegen"-knop in busy-state
- [ ] **Split** — bestand geladen + page-count, range-input ongeldig (foutmelding), range-input geldig (geparste lijst)
- [ ] **Invullen** — gerenderde A4-page met 1 tekstveld + lettergrootte-input
- [ ] **Ondertekenen** — modus A/B/C selectie, signature_pad met getekende stroke, plaatsing op page
- [ ] **Converteren** — file-list met 3 types kleur-badges, "Combineer" toggle aan/uit
- [ ] **OCR** — skelet-state (501-stub)
- [ ] **Output-bar** — na elke feature; print-dialog optioneel; mail-form 501-melding

## Hoe screenshots toevoegen

1. Open https://horsecloud55.ddns.net/PDFHorse/ in browser (Chrome/Firefox/Safari)
2. Cmd+Shift+4 (Mac) of Snipping Tool (Windows) voor selectie
3. Bewaar als PNG met conventie hierboven
4. `git add docs/screens/<bestand>.png && git commit -m "screens: <tab> <state>"`
5. Update deze checklist met `[x]`

## Privacy-overweging

Geen echte gebruiker-content in screenshots. Gebruik de meegeleverde test-bestanden:
- `~/Downloads/PDFHorse_test_A.pdf` / `B.pdf` (Merge)
- `~/Downloads/PDFHorse_test_C.docx` (Merge docx + Convert)
- `~/Downloads/PDFHorse_test_D.xlsx` (Convert)
- `~/Downloads/PDFHorse_test_invulformulier.pdf` (Fill)
