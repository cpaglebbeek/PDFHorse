---
date: 2026-06-20
repo: PDFHorse
status: closed
resume: ""
---

# Sessie 2026-06-20 — PDFHorse v0.23.0-Diffie pHash robuust + verdict met percentage

**Agent:** Claude Opus 4.7 (1M context)
**Repo:** PDFHorse (`cpaglebbeek/PDFHorse`)
**Branche:** main
**Cross-repo werk:** Geen — referentie naar `Meta_PhotoVerify/src/utils/perceptualHash.ts` voor `compareHashesElastic` port.
**Eindstand commits:** (zie git log na deze sessie, één commit: "PDFHorse v0.23.0-Diffie — pHash 16×16 dCT+dHash + elastic match + verdict %")

---

## Opdracht (samengevat)

Oranje (design impact) update aan de Hashing-tab van v0.22.0-Merkle. Probleem: 8×8 perceptueel-hash overleeft screenshot-attack niet en de verify-uitslag was binair "ok/niet ok" zonder percentage. Doel v0.23.0-Diffie: pHash robuust maken met twee extra 16×16 lagen (dCT + dHash), shift-tolerant elastic vergelijking porten uit PhotoVerify, en verify-verdict transparant maken met percentage (0–100 %) plus vier verdict-klassen (`IDENTICAL`/`LAYOUT_MATCH`/`PROBABLE`/`NO_MATCH`). Backwards compat met v0.22 poa-v1 PDFs blijft strikt geborgd. Geen new deps, browser-first, geen backend-wijziging.

---

## Prompts en acties — chronologisch

### Prompt 1 — "Je gaat PDFHorse v0.23.0-Diffie implementeren — een ORANJE (design impact) update aan de Hashing-tab"

**Actie:**
1. Sessie-startprotocol: `git -C Meta_Master pull` (already up to date), `git pull` op PDFHorse (already up to date), `git log/status` checked — schoon, geen parallel-sessie.
2. Gelezen: `PDFHorse/CLAUDE.md` (versioning + RCA + prompt-sessie + OEU), `frontend/js/hash.js` (huidige avg-hash), `Meta_PhotoVerify/src/utils/perceptualHash.ts` (referentie-implementatie `compareHashesElastic`), `frontend/js/app.js` regels 168-190 (`hashing` state), 1310-1453 (`runHash` + `runVerify`), `frontend/index.html` regels 985-1013 (verify-paneel), `frontend/i18n.json` 125-150, `docs/PRINCIPLES.md`, `CHANGELOG.md`, `version.json`.
3. `frontend/js/hash.js` uitgebreid:
   - Toegevoegd `pagePerceptualHashesDct()` met `_dctHash`/`_downscaleGray`/`_dct1d`/`_cosTable` — pure-JS dCT-II (separabel), median-bit op 16×16 low-freq blok, DC[0,0] uit median.
   - Toegevoegd `pagePerceptualHashesDhash()` met `_dhash` — 17×16 horizontale gradient → 256 bit.
   - Toegevoegd `compareHashesElastic(expectedHex, actualHex, bits, maxShift)` met `_hexToBitArray` helper — 5×5 shift-search, vierkant-fallback voor non-vierkante grids.
   - `pagePerceptualHashes()` (8×8 avg) ongewijzigd voor backwards compat.
   - Engine VERSION 0.1.0 → 0.2.0.
4. `frontend/js/app.js#runHash()` schrijft drie lagen + `poa_schema: 'poa-v2'` + envelope-marker `pdfhorse: 'poa-v2'`.
5. `frontend/js/app.js#runVerify()` herschreven: detecteert schema-versie, vergelijkt elastic per laag, per pagina `max()`, eindscore = gemiddelde, drempels → verdict. Backwards compat: v1 PDFs werken via avg-only-pad (geen dCT/dHash velden in meta → die lagen worden gewoon overgeslagen).
6. `frontend/index.html` verify-paneel: groot score-percentage + verdict-badge + uitleg-zin + per-pagina-tabel met kolommen avg/dCT/dHash/max.
7. `frontend/i18n.json` 11 nieuwe NL→EN entries.
8. `backend/tests/test_hash_v2.py` (Python regex-checks op `hash.js` voor aanwezigheid functies + window-exports + VERSION-bump).
9. `scripts/test_hash_v2.js` Node-unit-test voor pure-functie `compareHashesElastic` + `_hexToBitArray` zonder DOM/Canvas, via `vm.runInContext` met minimal `window`-stub.
10. `version.json` → 0.23.0/Diffie/2026-06-20.
11. `CHANGELOG.md` entry boven Merkle (Functioneel + Technisch + Architectonisch + Verified + Notes).
12. `docs/PRINCIPLES.md` → P-PoA-01 toegevoegd (verdict-formule, drempels, conflict-test).

**Keuze:** RCA bewust niet toegevoegd — oranje feature-bump, geen bugfix.

**Verificatie:** `node --check hash.js` + `node --check app.js` groen. `pytest backend/tests/` 34/34 groen (27 oud + 7 nieuwe structuur-tests). `node scripts/test_hash_v2.js` 6/6 groen (identiek/1-bit/1px-shift/random/64-bit/_hexToBitArray).

---

## Belangrijke keuzes deze sessie

| Keuze | Reden |
|---|---|
| **dCT pure-JS, geen FFT-lib** | P2 (CDN-only, geen build-pipeline) blijft intact; dCT-II is 2× `_dct1d` per pagina (32×32 = 1024 coeff-paren), snel genoeg voor 1-10 pagina's PDFs. |
| **Max-laag-wint per pagina, gemiddeld over pagina's** | Aansluiting bij PhotoVerify v8.3-drempels (0.98/0.85/0.75) die productie-gevalideerd zijn voor screenshot-attacks. |
| **`poa_schema: 'poa-v2'` ÉN envelope-marker `'poa-v2'`** | Twee detectie-punten = robuust tegen partiële payload-decodering; verify herkent v2 ook als top-marker per ongeluk verloren gaat. |
| **8×8 avg-hash blijft in `pagePerceptualHashes()`** | Backwards compat: bestaande v0.22 PoA-PDFs in de wereld blijven verifieerbaar — kritieke regel uit opdracht. |
| **Node-unit-tests voor `compareHashesElastic`** | Pure functie, geen DOM nodig → vm-context met minimal `window`-stub bewijst correctheid zonder jsdom/Canvas-zwaargewicht. |
| **Geen RCA in CHANGELOG** | Oranje feature, geen bugfix (CLAUDE.md zegt RCA = bugfix-protocol). |

---

## Open eindjes na deze sessie

**Klaar voor verzending / publicatie:**
- Commit + push naar `origin/main` na deze sessie-MD (in dezelfde commit).

**Wacht op afhankelijkheden:**
- **HC55 deploy** — gebruiker doet handmatig (opdracht: "HC55 deploy laat je. Stop NA push.").
- **UI-screenshot in `docs/screens/`** — vereist live preview om verify-paneel met percentage te capturen.

**Onafhankelijk werk:**
- Eventuele tuning van drempels (0.98/0.85/0.75) tegen real-world screenshot-attack-corpus.
- E2E Playwright-tests voor verify-modus uitbreiden met poa-v2 envelope (huidige 8/8 dekken nog poa-v1 flow).

---

## Verbinding met andere sessies

| Sessie | Locatie | Verbinding |
|---|---|---|
| 2026-06-18 hashing v0.22.0-Merkle | `PDFHorse/prompts/2026-06-18_hashing_v0220_merkle.md` | Voorganger: introduceerde Hashing-tab + PoA-flow + 8×8 avg-pHash dat in v0.23 gehandhaafd blijft als compat-laag. |
| PhotoVerify v8.3 elastic edition | `Meta_PhotoVerify/src/utils/perceptualHash.ts` (regels 60-122) | Bronfile voor de `compareHashesElastic`-port. Drempels (0.98/0.85/0.75) ook van daar. |

---

*PDFHorse / prompts / 2026-06-20_poa_v023_diffie_phash.md*
