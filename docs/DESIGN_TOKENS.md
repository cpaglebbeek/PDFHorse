# DESIGN_TOKENS — PDFHorse

> Visuele tokens voor de PDFHorse-UI. Bewust schraal en utility-first (Tailwind), passend bij iCt Horse-zusters (SVGEditor, FreeSaasArchimate, HorseSafe). Geen build-step.

## Bron

- **Tailwind CDN** (`https://cdn.tailwindcss.com`) — utility classes
- **Geen custom theme-config** — we gebruiken Tailwind's defaults zodat zusters dezelfde tokens delen

## Kleuren (Tailwind slate-palette, primair)

| Token | Tailwind class | Hex | Gebruik |
|---|---|---|---|
| `bg-default` | `bg-slate-50` | `#f8fafc` | Pagina-achtergrond |
| `bg-surface` | `bg-white` | `#ffffff` | Cards, drop-zones, list-items |
| `text-primary` | `text-slate-900` | `#0f172a` | Body-tekst, titels |
| `text-muted` | `text-slate-600` / `text-slate-500` | `#475569` / `#64748b` | Subtekst, hints |
| `text-faint` | `text-slate-400` | `#94a3b8` | Versie-label, footer |
| `border-default` | `border-slate-200` | `#e2e8f0` | Dividers, list-items |
| `border-drop` | `border-slate-300` (hover: `slate-500`, active: `slate-900`) | — | Drop-zone |
| `accent-action` | `bg-slate-900` + `text-white` | `#0f172a` | Primaire knoppen (Samenvoegen, Download) |
| `accent-success` | `text-emerald-700` | `#047857` | Succes-meldingen (na merge) |
| `accent-error` | `text-red-700` | `#b91c1c` | Foutmeldingen + verwijder-knop |
| `accent-header` | `bg-slate-900` + `text-slate-400` | — | Header & footer |

## Typografie

| Token | Tailwind class | Gebruik |
|---|---|---|
| `font-body` | (default = `font-sans` system stack) | Body |
| `text-h1` | `text-2xl font-semibold` | Pagina-titel |
| `text-h2` | `text-lg font-semibold` | Sectie-titel (tab-content) |
| `text-h3` | `text-base font-semibold` | Sub-sectie ("Uitvoer", "Status") |
| `text-body` | `text-sm` | Body |
| `text-meta` | `text-xs` | Status, limieten, footer |
| `font-mono` | `font-mono` | Versie/codenaam-output, numerieke prefixes |

## Spacing & layout

- **Container:** `max-w-5xl mx-auto px-4` — main + header + footer
- **Section-padding:** `py-6` (main), `py-4` (header/footer)
- **Card-padding:** `p-4` (list-items met `px-3 py-2`)
- **Drop-zone padding:** `p-8` (was `p-12` in v0.0.2, verlaagd om file-list direct te zien)
- **Gap default:** `gap-2` (knoppen, list-items), `gap-3` (action-bar)
- **Border-radius:** `rounded` (knoppen, list-items), `rounded-lg` (cards, drop-zones)
- **Border-width:** `border` (default), `border-2 border-dashed` (drop-zone)

## States

| State | Tailwind |
|---|---|
| `disabled` | `disabled:opacity-40` (primair) / `disabled:opacity-30` (icon-knoppen) |
| `hover` (link) | `hover:text-white` (header) / `hover:text-slate-900` (tab) |
| `hover` (drop-zone) | `hover:border-slate-500` |
| `drag-over` | `border-slate-900 bg-slate-100` |
| `active tab` | `border-b-2 border-slate-900 text-slate-900` |
| `inactive tab` | `text-slate-500 hover:text-slate-900` |

## Iconografie

- Geen icon-font. Unicode-glyphs voor compactheid: `↑ ↓ ✕ →`.
- Toekomstig: lucide-icons via CDN als tab-icons nodig zijn.

## Accessibility-tokens

- Tab-buttons hebben `role="tab"` + `aria-selected`.
- Tab-panes hebben `role="tabpanel"` + `aria-labelledby`.
- Drop-zone is een `<label>` voor de hidden `<input type="file">` — toetsenbord-bereikbaar.
- File-list is `<ul>` met `aria-label="PDF's in volgorde"`.
- Order-knoppen hebben `aria-label="Omhoog"/"Omlaag"/"Verwijder"`.

## Versiehistorie tokens

| Versie | Wijziging |
|---|---|
| v0.0.2-Warnock | Initiële palette (slate) + tab-stijl |
| v0.1.0-Geschke | DESIGN_TOKENS.md vastgelegd. Toegevoegd: emerald (success), red (error/remove), drag-over state, file-list spacing |
