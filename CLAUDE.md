# CLAUDE.md — PDFHorse

> **iCt Horse tooling SaaS, direct onder ecosysteem `iCt Horse` (NIET in `Meta_iCt_Horse_Diensten`).**
> Naast zusters SVGEditor + FreeSaasArchimate. PUBLIC AGPL-3.0. Hosting: HC55 `:3963` + nginx `icthorse.nl/PDFHorse/`.

## Sessie-start

1. `git -C /Users/christian/Documents/Gemini_Projects/Meta_Master pull` (verplicht, hoort altijd)
2. Lees `Meta_Master/PROJECTS.json` ecosysteem `iCt Horse` voor tooling-context
3. Lees `Meta_Master/SHARED_INFRASTRUCTURE.md` (raakt Hetzner)

## Project-doel

Anonieme browser-first PDF-bewerker. Functies: merge, split, OCR (NL+EN), invullen, ondertekenen (bitmap/SVG/live), output naar download/print/mail (`pdfservice@icthorse.nl`).

Volledig overzicht: [`README.md`](README.md). Architectuur: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Versioning & codenamen (verplicht)

Elke functionele/technische wijziging → `version.json` ophogen + codenaam uit thema **PDF-pioniers**.

| Type | Versiebump | Voorbeeld |
|---|---|---|
| Groen (code only) | +0.0.1 | v0.0.1 → v0.0.2 |
| Oranje (design/UX/arch impact, logische arch stabiel) | +0.1.0 | v0.0.7 → v0.1.0 |
| Rood (redesign, meta-implicaties) | +1.0.0 | v0.9.x → v1.0.0 |

Codenamen-shortlist (PDF-pioniers): Warnock, Geschke, Brotz, Wozencraft, Putman, Taft, Crocker.

## Bugfix-protocol (kleurcodering)

- **Groen** — snel fysiek herstel (typo, kleine logica)
- **Geel** — out-of-physical-box (logische architectuur raakt)
- **Rood** — out-of-the-box (conceptueel redesign + Security Audit verplicht)
- **Loop** — debug-loop, nieuwe invalshoek

**RCA verplicht (3 niveaus):** Functioneel, Technisch, Architectonisch.
**BUGLIST.md** in `docs/` bijhouden volgens `Meta_Master/templates/BUGLIST_TEMPLATE.md`.

## WhatIf Protocol (verplicht)

Vóór elke code/build/config/architectuur-actie: (1) Begrip terugkoppelen, (2) Plan voorleggen, (3) Impactanalyse, (4) Akkoord vragen.

## Expliciete Vastlegging (verplicht)

Alle UI-componenten, kleuren, typografie, data-flow, dependencies, ontwerpbeslissingen vastleggen. Bij wijziging: documentatie mee-updaten.

Verplichte files:
- `ARCHITECTURE.md` — componenten + relaties + data-flow
- `docs/DESIGN_TOKENS.md` — kleuren, typografie, spacing (na eerste UI-werk)
- `docs/PRINCIPLES.md` — conceptuele principes
- `docs/DEPENDENCIES.md` — component-afhankelijkheden + impact-matrix
- `docs/screens/` — per-scherm specs (na eerste UI)
- `docs/PRIVACY.md` — privacystatement (vóór go-live)

## Prompt-sessies (verplicht)

Elke sessie: `prompts/YYYY-MM-DD_korte_slug.md` met frontmatter `date/repo/status/resume:` conform `Meta_Master/templates/PROMPT_SESSION_TEMPLATE.md`. Direct commit + push.

## Shared Infrastructure Awareness (HC55)

PDFHorse draait op HC55 poort **`:3963`**. Andere services op HC55:
| Poort | Service |
|---|---|
| 3000 | ClaudeWeb |
| 3800 | RandomRingtone Logger |
| 3900 | HorseCloud default |
| 3950 | CarriereCV |
| 3960 | HorseAccounting |
| 3962 | iCt_Horse_Facturatie (gepland) |
| **3963** | **PDFHorse** |
| 3970 | MacTerminal |
| 3980 | Dashboard |
| 3985 | PrioMail |
| 3995 | SMSRelay |
| 3996 | ClaudeBug |
| 3997 | HorseSafe |

Nginx-config is **gedeeld** — bij wijziging: ALLE location blocks behouden. Volledig: `Meta_Master/SHARED_INFRASTRUCTURE.md`.

## ZSH Safety

Geen `path` / `cdpath` / `status` / `commands` / `history` als var. Gebruik `repo_path`, `local_path`, `dir`, `p`.

## Mail-infra

Uitgaande SMTP via Hostinger (`smtp.hostinger.com:587` STARTTLS, **Facturatie-stijl hergebruik**):
- `SMTP_USER=info@icthorse.nl` — bestaande iCt Horse-mailbox, geen actie nodig.
- `MAIL_FROM="PDFHorse <info@icthorse.nl>"` — **adres MOET = SMTP_USER**. Hostinger weigert from ≠ auth (e2e 2026-06-14 bewezen: SMTPRecipientsRefused). Display-name mag vrij.
- `MAIL_REPLY_TO=info@icthorse.nl` — replies op dezelfde mailbox.
- Credentials op HC55 in `/opt/pdfhorse/.env` (mode 600, copy `SMTP_PASSWORD` uit `EMAIL_HOST_PASSWORD` in `/opt/facturatie/.env`); template `backend/.env.example`. Niet gecommit (`.gitignore`).

## "Over en uit" Protocol

Bij OEU: commit + push PDFHorse + Meta_Master (PROJECTS/STATUS). Memory sync. Gemini/Codex sync-bestanden. Resume-register regen.

## Multi-Session Conflict Prevention

Bij start: `git pull` + `git log --oneline -5` + `git status --short`. Bij uncommitted: vraag of andere sessie actief is.
