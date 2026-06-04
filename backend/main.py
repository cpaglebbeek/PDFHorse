"""PDFHorse backend — FastAPI app.

Endpoints:
  GET  /api/health   — liveness/readiness
  GET  /api/limits   — server-zijde geadverteerde limieten
  POST /api/ocr      — STUB (501) — wordt uitgewerkt zodra Tesseract op host beschikbaar is
  POST /api/mail     — STUB (501) — wordt uitgewerkt zodra Hostinger mailbox aangemaakt is
"""
from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
SESSION_TIMEOUT_S = int(os.environ.get("SESSION_TIMEOUT_S", "1800"))
TMP_DIR = Path(os.environ.get("TMP_DIR", "/tmp/pdfhorse"))

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


@app.post("/api/ocr")
async def ocr() -> JSONResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="OCR endpoint stub — implementatie in v0.0.3 (ocrmypdf + Tesseract nld+eng).",
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
