"""Smoke-tests v0.0.2 — alleen wat het skeleton garandeert."""
from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health_returns_ok():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "pdfhorse"
    assert body["version"]
    # Codenaam wordt gelezen uit version.json en muteert per release;
    # we accepteren elke niet-lege string.
    assert isinstance(body["codename"], str) and body["codename"]


def test_limits_returns_numbers():
    r = client.get("/api/limits")
    assert r.status_code == 200
    body = r.json()
    assert body["max_upload_size_bytes"] == 50 * 1024 * 1024
    assert body["max_session_total_bytes"] == 100 * 1024 * 1024
    assert body["session_timeout_s"] == 1800
    assert "nld" in body["ocr_languages"]
    assert "eng" in body["ocr_languages"]


def test_ocr_rejects_non_pdf():
    r = client.post(
        "/api/ocr",
        files={"file": ("foo.docx", b"PK\x03\x04", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert r.status_code == 415


def test_ocr_rejects_empty():
    r = client.post("/api/ocr", files={"file": ("empty.pdf", b"", "application/pdf")})
    assert r.status_code == 400


def test_ocr_returns_503_when_ocrmypdf_absent(monkeypatch):
    from backend import main as backend_main
    monkeypatch.setattr(backend_main, "OCRMYPDF_BIN", "/usr/bin/definitely-not-ocrmypdf-xyz")
    r = client.post(
        "/api/ocr",
        files={"file": ("x.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert r.status_code == 503


def test_mail_stub_returns_501():
    r = client.post("/api/mail")
    assert r.status_code == 501


def test_convert_rejects_non_docx_extension():
    r = client.post(
        "/api/convert/docx-to-pdf",
        files={"file": ("notdocx.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert r.status_code == 415


def test_convert_rejects_empty_upload():
    r = client.post(
        "/api/convert/docx-to-pdf",
        files={"file": ("empty.docx", b"", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert r.status_code == 400


def test_xlsx_rejects_non_xlsx_extension():
    r = client.post(
        "/api/convert/xlsx-to-pdf",
        files={"file": ("notxlsx.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert r.status_code == 415


def test_xlsx_returns_503_when_soffice_absent(monkeypatch):
    from backend import main as backend_main
    monkeypatch.setattr(backend_main, "SOFFICE_BIN", "/usr/bin/definitely-not-soffice-xyz")
    r = client.post(
        "/api/convert/xlsx-to-pdf",
        files={"file": ("x.xlsx", b"PK\x03\x04minimal", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert r.status_code == 503


def test_convert_returns_503_when_soffice_absent(monkeypatch):
    # Forceer FileNotFoundError door SOFFICE_BIN op een niet-bestaand commando te zetten.
    monkeypatch.setenv("SOFFICE_BIN", "/usr/bin/definitely-not-soffice-xyz")
    # Reload niet nodig — env wordt elke request opnieuw gelezen door subprocess.run
    # (we lezen de env-var direct in convert_docx_to_pdf via module-level constante).
    # Voor deze test patchen we de constante via app-state:
    from backend import main as backend_main
    monkeypatch.setattr(backend_main, "SOFFICE_BIN", "/usr/bin/definitely-not-soffice-xyz")
    r = client.post(
        "/api/convert/docx-to-pdf",
        files={"file": ("x.docx", b"PK\x03\x04minimal", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert r.status_code == 503
