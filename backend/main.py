"""PDFHorse backend — FastAPI app.

Endpoints:
  GET  /api/health                 — liveness/readiness
  GET  /api/limits                 — server-zijde geadverteerde limieten
  POST /api/convert/docx-to-pdf    — docx → PDF via LibreOffice headless (v0.6.0)
  POST /api/ocr                    — STUB (501) — wacht op Tesseract install
  POST /api/mail                   — STUB (501) — wacht op Hostinger mailbox
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

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
MAX_OCR_BYTES = int(os.environ.get("MAX_OCR_BYTES", str(50 * 1024 * 1024)))
SESSION_TIMEOUT_S = int(os.environ.get("SESSION_TIMEOUT_S", "1800"))
TMP_DIR = Path(os.environ.get("TMP_DIR", "/tmp/pdfhorse"))
SOFFICE_BIN = os.environ.get("SOFFICE_BIN", "soffice")
SOFFICE_TIMEOUT_S = int(os.environ.get("SOFFICE_TIMEOUT_S", "60"))
OCRMYPDF_BIN = os.environ.get("OCRMYPDF_BIN", "ocrmypdf")
OCR_LANGUAGES = os.environ.get("OCR_LANGUAGES", "nld+eng")
OCR_TIMEOUT_S = int(os.environ.get("OCR_TIMEOUT_S", "180"))

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

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


@app.post("/api/mail")
async def mail() -> JSONResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Mail endpoint stub — implementatie in v0.0.3 (SMTP via pdfservice@icthorse.nl).",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host=APP_HOST, port=APP_PORT, reload=True)
