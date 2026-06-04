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
    assert body["codename"] == "Warnock"


def test_limits_returns_numbers():
    r = client.get("/api/limits")
    assert r.status_code == 200
    body = r.json()
    assert body["max_upload_size_bytes"] == 50 * 1024 * 1024
    assert body["max_session_total_bytes"] == 100 * 1024 * 1024
    assert body["session_timeout_s"] == 1800
    assert "nld" in body["ocr_languages"]
    assert "eng" in body["ocr_languages"]


def test_ocr_stub_returns_501():
    r = client.post("/api/ocr")
    assert r.status_code == 501


def test_mail_stub_returns_501():
    r = client.post("/api/mail")
    assert r.status_code == 501
