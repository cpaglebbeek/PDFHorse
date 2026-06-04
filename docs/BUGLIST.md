# BUGLIST.md — PDFHorse

**Doel:** alle bugs van dit project + preventieregels zodat ze niet terugkeren.
**Onderhoud:** bij elke bugfix verplicht bijwerken (zie `feedback_debug_buglist_protocol`).

---

## Samenvatting

| Status | Aantal |
|--------|--------|
| 🔴 Open | 0 |
| 🟠 Recurring (terugkerend patroon) | 0 |
| ✅ Closed | 0 |
| **Totaal** | **0** |

---

## Terugkerende patronen (escalatie-zone)

Bugs die ≥2× zijn voorgekomen krijgen hier een eigen entry met **harder borgingsmechanisme** (hook, test, checklist-item). Zie ook `Meta_Master/BUGS_GLOBAL.md` voor cross-repo patronen.

_Geen terugkerende patronen vastgesteld._

---

## Open bugs

_Geen open bugs._

---

## Closed bugs

_Geen gesloten bugs._

---

## Bug-entry format (kopieer dit blok)

```markdown
### PDFH-NNN — Korte titel

**Status:** 🔴 Open / ✅ Closed / 🟠 Recurring
**Severity:** rood / oranje / geel / groen (per CLAUDE.md kleurcodering)
**Versie ontdekt:** v0.x.y-Codename
**Versie gefixt:** v0.x.y-Codename
**Datum:** YYYY-MM-DD

#### Symptoom
Wat zag de gebruiker?

#### Reproductie
Stappen om te reproduceren.

#### Root Cause Analysis (3 niveaus, verplicht)
- **Functioneel:** wat ging er functioneel mis?
- **Technisch:** welke code/configuratie veroorzaakte het?
- **Architectonisch:** welk dieper patroon (P1-P8 in PRINCIPLES) is geschonden?

#### Fix
Beschrijving + commit-hash.

#### Preventie
Welke test / lint / hook / checklist-item voorkomt dat dit terugkomt?
```

---

## Versiehistorie

| Versie | Wijziging |
|---|---|
| v0.3.0-Putman | **`docs/BUGLIST.md` skelet aangemaakt** uit Meta_Master/templates/BUGLIST_TEMPLATE.md |
