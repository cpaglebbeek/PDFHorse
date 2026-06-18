"""PDFHorse backend — FastAPI app.

Endpoints:
  GET  /api/health                 — liveness/readiness
  GET  /api/limits                 — server-zijde geadverteerde limieten
  POST /api/convert/docx-to-pdf    — docx → PDF via LibreOffice headless (v0.6.0)
  POST /api/convert/xlsx-to-pdf    — xlsx → PDF via LibreOffice headless (v0.7.0)
  POST /api/ocr                    — gescande PDF doorzoekbaar (v0.8.0)
  POST /api/mail                   — mail PDF via Hostinger SMTP (v0.9.0)
  POST /api/anchor                 — proxy SHA-256 digest naar OpenTimestamps (v0.22.0)
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import smtplib
import subprocess
import threading
import time
import urllib.error
import urllib.request
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path

from fastapi import Body, FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

# Versie + codenaam komen uit version.json zodat één bron-van-waarheid blijft
# bestaan (voorkomt drift tussen frontend label en backend /api/health).
def _load_version() -> tuple[str, str]:
    candidates = [
        Path(__file__).resolve().parent.parent / "version.json",  # repo-root naast backend/
        Path("/opt/pdfhorse/version.json"),                       # HC55 deploy
    ]
    for vp in candidates:
        try:
            data = json.loads(vp.read_text())
            return str(data.get("version", "0.0.0")), str(data.get("codename", "unknown"))
        except (OSError, ValueError):
            continue
    return "0.0.0", "unknown"

VERSION, CODENAME = _load_version()

APP_HOST = os.environ.get("APP_HOST", "127.0.0.1")
APP_PORT = int(os.environ.get("APP_PORT", "3963"))
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "https://horsecloud55.ddns.net")
MAX_UPLOAD_SIZE_BYTES = int(os.environ.get("MAX_UPLOAD_SIZE_BYTES", str(50 * 1024 * 1024)))
MAX_SESSION_TOTAL_BYTES = int(os.environ.get("MAX_SESSION_TOTAL_BYTES", str(100 * 1024 * 1024)))
MAX_DOCX_BYTES = int(os.environ.get("MAX_DOCX_BYTES", str(20 * 1024 * 1024)))
MAX_XLSX_BYTES = int(os.environ.get("MAX_XLSX_BYTES", str(20 * 1024 * 1024)))
MAX_ODT_BYTES = int(os.environ.get("MAX_ODT_BYTES", str(20 * 1024 * 1024)))
MAX_RTF_BYTES = int(os.environ.get("MAX_RTF_BYTES", str(20 * 1024 * 1024)))
MAX_OCR_BYTES = int(os.environ.get("MAX_OCR_BYTES", str(50 * 1024 * 1024)))
SESSION_TIMEOUT_S = int(os.environ.get("SESSION_TIMEOUT_S", "1800"))
TMP_DIR = Path(os.environ.get("TMP_DIR", "/tmp/pdfhorse"))
SOFFICE_BIN = os.environ.get("SOFFICE_BIN", "soffice")
SOFFICE_TIMEOUT_S = int(os.environ.get("SOFFICE_TIMEOUT_S", "60"))
OCRMYPDF_BIN = os.environ.get("OCRMYPDF_BIN", "ocrmypdf")
OCR_LANGUAGES = os.environ.get("OCR_LANGUAGES", "nld+eng")
OCR_TIMEOUT_S = int(os.environ.get("OCR_TIMEOUT_S", "180"))

# Mail (v0.9.0-Lamport) — hergebruikt Hostinger SMTP-conventie van iCt_Horse_Facturatie:
# SMTP_USER is een bestaande Hostinger-mailbox (info@icthorse.nl), MAIL_FROM mag een
# alias binnen hetzelfde domein zijn (pdfservice@icthorse.nl) zonder dat die mailbox bestaat.
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.hostinger.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_USE_SSL = os.environ.get("SMTP_USE_SSL", "False").lower() in ("1", "true", "yes")
SMTP_TIMEOUT_S = int(os.environ.get("SMTP_TIMEOUT_S", "30"))
# From-adres moet de SMTP_USER-mailbox zijn (Hostinger weigert from ≠ auth-user, ook
# binnen hetzelfde domein — e2e bewezen 2026-06-14 met SMTPRecipientsRefused). Display-name
# mag vrij zijn. Wil je een aparte branding-from (bv. pdfservice@icthorse.nl), dan moet die
# als echte Hostinger-mailbox of SMTP-account bestaan.
MAIL_FROM = os.environ.get("MAIL_FROM", "PDFHorse <info@icthorse.nl>")
MAIL_REPLY_TO = os.environ.get("MAIL_REPLY_TO", "info@icthorse.nl")
MAX_MAIL_ATTACHMENT_BYTES = int(os.environ.get("MAX_MAIL_ATTACHMENT_BYTES", str(5 * 1024 * 1024)))
MAX_MAIL_SUBJECT_LEN = int(os.environ.get("MAX_MAIL_SUBJECT_LEN", "200"))
MAX_MAIL_BODY_LEN = int(os.environ.get("MAX_MAIL_BODY_LEN", "100000"))
MAIL_RATE_PER_HOUR = int(os.environ.get("MAIL_RATE_PER_HOUR", "5"))
MAIL_RATE_WINDOW_S = int(os.environ.get("MAIL_RATE_WINDOW_S", "3600"))

# Anchoring (v0.22.0-Merkle) — proxy naar OpenTimestamps calendar.
# Browser kan de calendar niet rechtstreeks bereiken (CORS), dus we doen het server-zijde.
# Calendar accepteert raw 32-byte SHA-256 digest in body en retourneert binaire timestamp-bytes.
# Stub-mode voor tests/dev zonder netwerk-call.
OTS_CALENDAR_URL = os.environ.get("OTS_CALENDAR_URL", "https://a.pool.opentimestamps.org/digest")
OTS_TIMEOUT_S = int(os.environ.get("OTS_TIMEOUT_S", "20"))
ANCHOR_STUB = os.environ.get("PDFHORSE_ANCHOR_STUB", "0") in ("1", "true", "yes")
ANCHOR_RATE_PER_HOUR = int(os.environ.get("ANCHOR_RATE_PER_HOUR", "20"))
ANCHOR_RATE_WINDOW_S = int(os.environ.get("ANCHOR_RATE_WINDOW_S", "3600"))

# In-process rate-limiter (per remote IP). State-loss bij restart is acceptabel:
# low-volume endpoint, restarts zijn zeldzaam, geen privacy-impact.
_mail_rate_lock = threading.Lock()
_mail_rate_buckets: dict[str, deque[float]] = defaultdict(deque)
_anchor_rate_lock = threading.Lock()
_anchor_rate_buckets: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit_check(ip: str) -> tuple[bool, int]:
    """Return (allowed, used_in_window). Houdt timestamps bij in deque per IP."""
    now = time.time()
    cutoff = now - MAIL_RATE_WINDOW_S
    with _mail_rate_lock:
        bucket = _mail_rate_buckets[ip]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= MAIL_RATE_PER_HOUR:
            return False, len(bucket)
        bucket.append(now)
        return True, len(bucket)


def _anchor_rate_check(ip: str) -> tuple[bool, int]:
    now = time.time()
    cutoff = now - ANCHOR_RATE_WINDOW_S
    with _anchor_rate_lock:
        bucket = _anchor_rate_buckets[ip]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= ANCHOR_RATE_PER_HOUR:
            return False, len(bucket)
        bucket.append(now)
        return True, len(bucket)

# Conservatieve e-mail-regex (server-side validatie naast browser type=email).
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
ODT_MIME = "application/vnd.oasis.opendocument.text"
RTF_MIME = "application/rtf"

@asynccontextmanager
async def lifespan(app: FastAPI):
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="PDFHorse API",
    version=VERSION,
    description="Anonieme browser-first PDF-bewerker — server-zijde voor OCR + mail.",
    lifespan=lifespan,
)

# CORS strict op iCt Horse-domein; dev-fallback voor lokaal werk.
allowed_origins = [ALLOWED_ORIGIN]
if os.environ.get("PDFHORSE_DEV") == "1":
    allowed_origins.extend(["http://localhost:5173", "http://127.0.0.1:5173"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=False,
)


@app.get("/api/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "pdfhorse",
        "version": VERSION,
        "codename": CODENAME,
    }


@app.get("/api/limits")
async def limits() -> dict[str, object]:
    return {
        "max_upload_size_bytes": MAX_UPLOAD_SIZE_BYTES,
        "max_session_total_bytes": MAX_SESSION_TOTAL_BYTES,
        "session_timeout_s": SESSION_TIMEOUT_S,
        "ocr_languages": ["nld", "eng"],
    }


async def _office_to_pdf(
    file: UploadFile,
    *,
    ext: str,
    mime: str,
    max_bytes: int,
) -> FileResponse:
    """Generieke `soffice --headless --convert-to pdf` wrapper.

    Privacy: input + output in unieke `/tmp/pdfhorse/<uuid>/`-map, opgeruimd
    via `BackgroundTask shutil.rmtree` na de response. Geen content-logging.
    """
    name = file.filename or f"upload.{ext}"
    if not (name.lower().endswith(f".{ext}") or file.content_type == mime):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Alleen .{ext}-bestanden worden geaccepteerd.",
        )

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Bestand groter dan {max_bytes // (1024 * 1024)} MB.",
            )
        chunks.append(chunk)
    data = b"".join(chunks)
    if not data:
        raise HTTPException(status_code=400, detail="Lege upload.")

    work = TMP_DIR / uuid.uuid4().hex
    work.mkdir(parents=True, exist_ok=False)
    in_path = work / f"in.{ext}"
    in_path.write_bytes(data)

    try:
        result = subprocess.run(
            [
                SOFFICE_BIN,
                f"-env:UserInstallation=file://{work}/soffice-profile",
                "--headless",
                "--nologo",
                "--nofirststartwizard",
                "--convert-to",
                "pdf",
                "--outdir",
                str(work),
                str(in_path),
            ],
            capture_output=True,
            timeout=SOFFICE_TIMEOUT_S,
            check=False,
        )
        if result.returncode != 0:
            shutil.rmtree(work, ignore_errors=True)
            raise HTTPException(
                status_code=502,
                detail=f"LibreOffice-conversie mislukt: {result.stderr.decode('utf-8', 'replace')[:200]}",
            )
        out_path = work / "in.pdf"
        if not out_path.exists():
            shutil.rmtree(work, ignore_errors=True)
            raise HTTPException(status_code=502, detail="Conversie leverde geen PDF op.")
        return FileResponse(
            path=out_path,
            media_type="application/pdf",
            filename=Path(name).stem + ".pdf",
            background=_cleanup_task(work),
        )
    except subprocess.TimeoutExpired:
        shutil.rmtree(work, ignore_errors=True)
        raise HTTPException(status_code=504, detail="LibreOffice-conversie verliep timeout.")
    except FileNotFoundError:
        shutil.rmtree(work, ignore_errors=True)
        raise HTTPException(
            status_code=503,
            detail="LibreOffice (soffice) is niet beschikbaar op deze server.",
        )


@app.post("/api/convert/docx-to-pdf")
async def convert_docx_to_pdf(file: UploadFile = File(...)) -> FileResponse:
    """Converteert .docx → PDF via LibreOffice headless. v0.6.0-Paxton."""
    return await _office_to_pdf(file, ext="docx", mime=DOCX_MIME, max_bytes=MAX_DOCX_BYTES)


@app.post("/api/convert/xlsx-to-pdf")
async def convert_xlsx_to_pdf(file: UploadFile = File(...)) -> FileResponse:
    """Converteert .xlsx → PDF via LibreOffice headless. v0.7.0-Knuth."""
    return await _office_to_pdf(file, ext="xlsx", mime=XLSX_MIME, max_bytes=MAX_XLSX_BYTES)


@app.post("/api/convert/odt-to-pdf")
async def convert_odt_to_pdf(file: UploadFile = File(...)) -> FileResponse:
    """Converteert .odt → PDF via LibreOffice headless. v0.9.1-Mittelbach."""
    return await _office_to_pdf(file, ext="odt", mime=ODT_MIME, max_bytes=MAX_ODT_BYTES)


@app.post("/api/convert/rtf-to-pdf")
async def convert_rtf_to_pdf(file: UploadFile = File(...)) -> FileResponse:
    """Converteert .rtf → PDF via LibreOffice headless. v0.9.1-Mittelbach."""
    return await _office_to_pdf(file, ext="rtf", mime=RTF_MIME, max_bytes=MAX_RTF_BYTES)


def _cleanup_task(work_dir: Path):
    """Background-task die na de FileResponse de werkmap verwijdert."""
    from starlette.background import BackgroundTask

    def _do_cleanup() -> None:
        shutil.rmtree(work_dir, ignore_errors=True)

    return BackgroundTask(_do_cleanup)


@app.post("/api/ocr")
async def ocr(file: UploadFile = File(...)) -> FileResponse:
    """Maakt een gescande PDF doorzoekbaar via `ocrmypdf` (Tesseract nld+eng).

    Privacy: input + output in unieke `/tmp/pdfhorse/<uuid>/`-map, opgeruimd
    via `BackgroundTask shutil.rmtree`. Geen content-logging.
    v0.8.0-Reid.
    """
    name = file.filename or "upload.pdf"
    if not (name.lower().endswith(".pdf") or file.content_type == "application/pdf"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Alleen PDF-bestanden worden geaccepteerd.",
        )

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_OCR_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Bestand groter dan {MAX_OCR_BYTES // (1024 * 1024)} MB.",
            )
        chunks.append(chunk)
    data = b"".join(chunks)
    if not data:
        raise HTTPException(status_code=400, detail="Lege upload.")

    work = TMP_DIR / uuid.uuid4().hex
    work.mkdir(parents=True, exist_ok=False)
    in_path = work / "in.pdf"
    out_path = work / "out.pdf"
    in_path.write_bytes(data)

    try:
        result = subprocess.run(
            [
                OCRMYPDF_BIN,
                "--language", OCR_LANGUAGES,
                "--skip-text",       # skip pages die al tekst hebben (idempotent)
                "--output-type", "pdf",
                "--quiet",
                str(in_path),
                str(out_path),
            ],
            capture_output=True,
            timeout=OCR_TIMEOUT_S,
            check=False,
        )
        if result.returncode != 0:
            shutil.rmtree(work, ignore_errors=True)
            raise HTTPException(
                status_code=502,
                detail=f"OCR mislukt: {result.stderr.decode('utf-8', 'replace')[:200]}",
            )
        if not out_path.exists():
            shutil.rmtree(work, ignore_errors=True)
            raise HTTPException(status_code=502, detail="OCR leverde geen PDF op.")
        return FileResponse(
            path=out_path,
            media_type="application/pdf",
            filename=Path(name).stem + "_ocr.pdf",
            background=_cleanup_task(work),
        )
    except subprocess.TimeoutExpired:
        shutil.rmtree(work, ignore_errors=True)
        raise HTTPException(status_code=504, detail="OCR verliep timeout.")
    except FileNotFoundError:
        shutil.rmtree(work, ignore_errors=True)
        raise HTTPException(
            status_code=503,
            detail="ocrmypdf is niet beschikbaar op deze server.",
        )


def _default_mail_body(filename: str) -> str:
    return (
        "Hallo,\n\n"
        "Hierbij je PDFHorse-uitvoer in de bijlage"
        f" ({filename}).\n\n"
        "Deze mail is verstuurd via https://horsecloud55.ddns.net/PDFHorse/ —\n"
        "een anonieme, browser-first PDF-bewerker. Geen account, geen archief.\n\n"
        "Vragen? Reply op deze mail (komt aan op info@icthorse.nl).\n\n"
        "— PDFHorse"
    )


def _build_mail_message(
    *,
    to_addr: str,
    subject: str,
    body: str,
    pdf_bytes: bytes,
    pdf_filename: str,
) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = MAIL_FROM
    msg["To"] = formataddr((None, to_addr))
    msg["Subject"] = subject
    msg["Reply-To"] = MAIL_REPLY_TO
    msg["Message-ID"] = make_msgid(domain="icthorse.nl")
    msg["X-Mailer"] = f"PDFHorse/{VERSION}"
    msg.set_content(body)
    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=pdf_filename,
    )
    return msg


def _send_via_smtp(msg: EmailMessage) -> None:
    """Synchronous SMTP-call — wordt vanuit async handler via asyncio.to_thread aangeroepen."""
    if not SMTP_USER or not SMTP_PASSWORD:
        raise RuntimeError("SMTP_USER/SMTP_PASSWORD niet geconfigureerd")
    if SMTP_USE_SSL:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_S) as s:
            s.login(SMTP_USER, SMTP_PASSWORD)
            s.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_S) as s:
            s.starttls()
            s.login(SMTP_USER, SMTP_PASSWORD)
            s.send_message(msg)


@app.post("/api/mail", response_model=None)
async def mail(
    request: Request,
    to: str = Form(...),
    subject: str = Form("PDFHorse-uitvoer"),
    body: str = Form(""),
    pdf: UploadFile = File(...),
) -> JSONResponse:
    """Mailt een PDF-attachment via Hostinger SMTP. v0.9.0-Lamport.

    Privacy: geen logging van adres/onderwerp/body, geen BCC-self, geen archief.
    De PDF blijft alleen in memory tot de SMTP-call slaagt.
    Rate-limit: `MAIL_RATE_PER_HOUR` (default 5/uur per IP, in-process bucket).
    """
    client_ip = (request.client.host if request.client else "unknown") or "unknown"
    allowed, used = _rate_limit_check(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Mail-limiet bereikt ({used}/{MAIL_RATE_PER_HOUR} per uur per IP).",
        )

    to_addr = to.strip()
    if not _EMAIL_RE.match(to_addr) or len(to_addr) > 254:
        raise HTTPException(status_code=400, detail="Ongeldig e-mailadres.")

    subject = (subject or "PDFHorse-uitvoer").strip()[:MAX_MAIL_SUBJECT_LEN]
    body = (body or "").strip()[:MAX_MAIL_BODY_LEN]

    pdf_name = (pdf.filename or "pdfhorse_output.pdf").strip()
    if not pdf_name.lower().endswith(".pdf") or pdf.content_type not in (
        "application/pdf",
        "application/octet-stream",
        None,
        "",
    ):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Alleen een PDF-attachment wordt geaccepteerd.",
        )

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await pdf.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_MAIL_ATTACHMENT_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Bijlage groter dan {MAX_MAIL_ATTACHMENT_BYTES // (1024 * 1024)} MB.",
            )
        chunks.append(chunk)
    pdf_bytes = b"".join(chunks)
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Lege PDF-attachment.")
    if not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Bijlage is geen geldige PDF (ontbrekende %PDF-header).",
        )

    msg = _build_mail_message(
        to_addr=to_addr,
        subject=subject,
        body=body or _default_mail_body(Path(pdf_name).name),
        pdf_bytes=pdf_bytes,
        pdf_filename=Path(pdf_name).name,
    )

    try:
        await asyncio.to_thread(_send_via_smtp, msg)
    except RuntimeError as e:
        # ontbrekende SMTP-creds — server-misconfig, niet de client zijn schuld
        raise HTTPException(status_code=503, detail=str(e))
    except (smtplib.SMTPAuthenticationError, smtplib.SMTPSenderRefused) as e:
        raise HTTPException(status_code=502, detail=f"SMTP-authenticatie geweigerd: {e}")
    except smtplib.SMTPRecipientsRefused:
        raise HTTPException(status_code=400, detail="Ontvangstadres geweigerd door SMTP-server.")
    except (smtplib.SMTPException, OSError) as e:
        raise HTTPException(status_code=502, detail=f"SMTP-fout: {e}")

    return JSONResponse(
        status_code=200,
        content={"status": "sent", "to": to_addr, "bytes": total},
    )


_HEX64 = re.compile(r"^[0-9a-fA-F]{64}$")


def _ots_fetch(digest_bytes: bytes) -> bytes:
    """Synchroon HTTP-POST naar OpenTimestamps calendar.

    Geen externe lib nodig — `urllib` volstaat. Calendar verwacht raw 32-byte digest
    in body, retourneert binaire (incomplete) timestamp. Latere `ots upgrade` (door
    de gebruiker, los van deze service) maakt het Bitcoin-anchor compleet.
    """
    req = urllib.request.Request(
        OTS_CALENDAR_URL,
        data=digest_bytes,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": f"PDFHorse/{VERSION}",
            "Accept": "application/octet-stream",
        },
    )
    with urllib.request.urlopen(req, timeout=OTS_TIMEOUT_S) as resp:  # noqa: S310
        return resp.read()


@app.post("/api/anchor")
async def anchor(
    request: Request,
    payload: dict = Body(...),
) -> Response:
    """Anchor een SHA-256 digest via OpenTimestamps calendar. v0.22.0-Merkle.

    Body: `{"sha256": "<64-hex>"}`.
    Returns: binary `.ots` stub (application/octet-stream).
    Privacy: digest gaat 1× naar de OTS-calendar; geen origineel bestand,
    geen owner-data, geen logging.
    """
    client_ip = (request.client.host if request.client else "unknown") or "unknown"
    allowed, used = _anchor_rate_check(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Anchor-limiet bereikt ({used}/{ANCHOR_RATE_PER_HOUR} per uur per IP).",
        )

    digest_hex = (payload.get("sha256") or "").strip()
    if not _HEX64.match(digest_hex):
        raise HTTPException(status_code=400, detail="sha256 moet 64 hex-tekens zijn.")
    digest_bytes = bytes.fromhex(digest_hex)

    if ANCHOR_STUB:
        # Deterministische pseudo-ots-bytes voor tests: magic + digest + iso-tijdstempel.
        ts = f"{int(time.time())}".encode()
        stub = b"PDFHORSE-OTS-STUB\x00" + digest_bytes + b"\x00" + ts
        return Response(
            content=stub,
            media_type="application/octet-stream",
            headers={
                "X-PDFHorse-Anchor": "stub",
                "X-PDFHorse-Calendar": "stub",
            },
        )

    try:
        ots_bytes = await asyncio.to_thread(_ots_fetch, digest_bytes)
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"OTS-calendar fout: {e.code} {e.reason}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=503, detail=f"OTS-calendar onbereikbaar: {e.reason}")
    except TimeoutError:
        raise HTTPException(status_code=504, detail="OTS-calendar timeout.")
    if not ots_bytes:
        raise HTTPException(status_code=502, detail="OTS-calendar leverde lege response.")

    return Response(
        content=ots_bytes,
        media_type="application/octet-stream",
        headers={
            "X-PDFHorse-Anchor": "ots",
            "X-PDFHorse-Calendar": OTS_CALENDAR_URL,
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host=APP_HOST, port=APP_PORT, reload=True)
