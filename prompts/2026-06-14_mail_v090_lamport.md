---
date: 2026-06-14
repo: PDFHorse
status: open
resume: "PDFHorse v0.9.0-Lamport: mail-endpoint live op code-niveau; HC55 deploy = rsync + /opt/pdfhorse/.env invullen met SMTP_PASSWORD (copy uit /opt/facturatie/.env) + systemctl restart pdfhorse + smoke-test via output-bar"
---

# Sessie 2026-06-14 — v0.9.0-Lamport: mail-endpoint LIVE

**Agent:** Claude Opus 4.7 (1M context)
**Repo:** PDFHorse
**Aanleiding:** "verder met pdfhorse"; user wees op Facturatie-precedent (info@icthorse.nl SMTP-auth + facturen@icthorse.nl reply-to) → Hostinger-mailbox-actie was nooit nodig.

## WhatIf-uitkomst

Routes vergeleken:
- **A** Gmail SMTP — fout aangenomen op basis van settings.py defaults; productie Facturatie gebruikt al Hostinger SMTP.
- **B** Hostinger PHP-relay (Heeres-stijl) — vereist 1× PHP-upload op Hostinger.
- **C** Hostinger SMTP hergebruik (Facturatie-stijl) — **0 Hostinger-acties** door `info@icthorse.nl`-creds te hergebruiken en `pdfservice@icthorse.nl` als alias-from te gebruiken.

Gekozen: **Route C**. Codenaam **Lamport** (Leslie Lamport, LaTeX 1984, document-distributie).

## Uitgevoerd

### Backend (`backend/main.py`)
- Imports: `smtplib`, `email.message.EmailMessage`, `email.utils.formataddr/make_msgid`, `asyncio`, `re`, `threading`, `time`, `collections.deque/defaultdict`.
- Env-constants: `SMTP_HOST/PORT/USER/PASSWORD/USE_SSL/TIMEOUT_S`, `MAIL_FROM`, `MAIL_REPLY_TO`, `MAX_MAIL_ATTACHMENT_BYTES=5MB`, `MAX_MAIL_SUBJECT_LEN=200`, `MAX_MAIL_BODY_LEN=100000`, `MAIL_RATE_PER_HOUR=5`, `MAIL_RATE_WINDOW_S=3600`.
- `_EMAIL_RE` regex (max 254 chars).
- `_rate_limit_check(ip)` — thread-safe deque per IP; sliding window.
- `_default_mail_body(filename)` — vriendelijke NL-tekst met PDFHorse-attributie + Reply-To-hint.
- `_build_mail_message(...)` — EmailMessage met From/To/Subject/Reply-To/Message-ID/X-Mailer + PDF-attachment.
- `_send_via_smtp(msg)` — sync; `SMTP_USE_SSL` toggle (SSL 465 of STARTTLS 587); raised RuntimeError als creds leeg.
- `POST /api/mail` (response_model=None om FastAPI ForwardRef-issue te omzeilen): rate-limit-check → e-mail-validatie → subject/body trimmen → attachment-extensie+MIME+`%PDF-`-header check → stream-read met chunk-limit → `asyncio.to_thread(_send_via_smtp, msg)` → JSON 200 {status, to, bytes}.
- HTTP-codes: 400 / 415 / 413 / 429 / 502 (SMTPException/OSError) / 503 (creds ontbreken).

### Slowapi-afgewezen (RCA — Technisch)
Eerste poging gebruikte `@limiter.limit("5/hour")` + `Annotated[UploadFile, File()]`. Python 3.14 + FastAPI + `from __future__ import annotations` + slowapi-wrapper veroorzaakt:
```
pydantic.errors.PydanticUserError: `TypeAdapter[typing.Annotated[ForwardRef('Annotated[str, Form()]'), ...]]` is not fully defined
```
De slowapi-decorator wrapt de coroutine, FastAPI re-evalueert annotations als strings, pydantic ziet dubbele `Annotated` en faalt. In-process bucket is functioneel gelijkwaardig voor low-volume mail. Slowapi blijft in `requirements.txt` voor evt. middleware-mode later.

### Frontend
- `frontend/index.html`: header → `v0.9.0 — Lamport`.
- `frontend/js/app.js` `mailLast()`: 501-pad weggehaald, 429-pad toegevoegd ("Mail-limiet bereikt"). Verder ongewijzigd — frontend stuurde al `to`/`subject`/`pdf`; `body` blijft optioneel (backend genereert default).

### Tests (`backend/tests/test_health.py` + nieuwe `conftest.py`)
- `test_mail_stub_returns_501` → vervangen door 7 nieuwe tests:
  - `test_mail_rejects_bad_email` → 400
  - `test_mail_rejects_non_pdf_attachment` → 415
  - `test_mail_rejects_pdf_without_header` → 415 (`%PDF-`-check)
  - `test_mail_rejects_empty_attachment` → 400
  - `test_mail_returns_503_when_smtp_creds_absent` → 503
  - `test_mail_rate_limit_returns_429` → loopt 5× door tot 200, dan 429
  - `test_mail_happy_path_with_monkeypatched_smtp` → 200, verifieert From/To/Reply-To/attachment
- `conftest.py` autouse-fixture reset `_mail_rate_buckets` per test (TestClient = één IP).
- Resultaat: **pytest 17/17 groen** (10 oud + 7 nieuw).

### Env / deploy
- `backend/.env.example` — alle SMTP_*/MAIL_*-vars met uitleg dat `SMTP_PASSWORD` uit `/opt/facturatie/.env` te kopiëren is.
- Geen wijziging aan `requirements.txt` (slowapi blijft).

### Docs
- `CHANGELOG.md` — entry v0.9.0-Lamport (Added/Changed/Decided/Tests/Deploy/Codename).
- `README.md` — versie/codename, status, features-tabel (mail nu ✅), tech-stack-bullet, Limieten-tabel, codenamen-tabel (Reid + Lamport rijen).
- `ARCHITECTURE.md` — endpoints-tabel (xlsx + ocr + mail bijgewerkt), mail-data-flow herschreven met SMTP-headers + asyncio.to_thread + HTTP-codes, Beveiliging-bullet rate-limit-keuze, Deployment `/opt/pdfhorse/.env`-template.
- `docs/DEPENDENCIES.md` — smtplib + email.message rijen actief, slowapi-rij "partial" met RCA-noot, Hostinger SMTP-rij actief sinds v0.9.0.
- `docs/PRIVACY.md` — mail-retentie verduidelijkt, SMTP-route herschreven, rate-limit-bullet, contact-mail → `info@icthorse.nl`.
- `CLAUDE.md` (PDFHorse) — Mail-infra sectie herschreven (Facturatie-stijl hergebruik, geen mailbox-actie).

## HC55 deploy — OPEN (gebruikersactie)

```bash
ssh hc55
cd /opt/pdfhorse
sudo -u www-data git -C /opt/pdfhorse pull   # of rsync vanaf Mac
sudo cp /opt/facturatie/.env /tmp/x.env && sudo grep SMTP_PASSWORD /tmp/x.env >> /opt/pdfhorse/.env && sudo rm /tmp/x.env
# of handmatig: nano /opt/pdfhorse/.env  → vul SMTP_PASSWORD in
sudo systemctl restart pdfhorse
curl -sf https://horsecloud55.ddns.net/PDFHorse/api/health | jq .   # → 0.9.0/Lamport
# E2E smoke: open UI → genereer kleine PDF (merge 1 file) → output-bar Mail → adres invoeren → verstuur
```

## Open na deploy

- E2E smoke door gebruiker (mail aankomst + Reply-To bevestiging op info@-mailbox).
- Verifiëren of Hostinger SMTP submission de from-alias accepteert (verwacht: ja, precedent Facturatie).
- v1.0.0-Brotz planning: SRI-hashes, icthorse.nl reverse-proxy, `docs/screens/` vullen.

## Codename-rationale

**Leslie Lamport** publiceerde LaTeX in 1984 als wrapper rond Knuths TeX om documenten distribueerbaar te maken (markup → device-onafhankelijke output). Past bij mail-fase: PDFHorse produceert al PDFs, mail-endpoint maakt ze distribueerbaar naar derden. Brotz reserve blijft v1.0.0.
