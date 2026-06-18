"""Tests voor /api/anchor (v0.22.0-Merkle)."""
from __future__ import annotations

import urllib.error

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

VALID_SHA = "a" * 64
INVALID_SHA = "zz" + "a" * 62
SHORT_SHA = "abc"


def test_anchor_rejects_invalid_hex():
    r = client.post("/api/anchor", json={"sha256": INVALID_SHA})
    assert r.status_code == 400


def test_anchor_rejects_short_hex():
    r = client.post("/api/anchor", json={"sha256": SHORT_SHA})
    assert r.status_code == 400


def test_anchor_rejects_missing_field():
    r = client.post("/api/anchor", json={})
    assert r.status_code == 400


def test_anchor_stub_mode_returns_bytes(monkeypatch):
    from backend import main as backend_main
    monkeypatch.setattr(backend_main, "ANCHOR_STUB", True)
    r = client.post("/api/anchor", json={"sha256": VALID_SHA})
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/octet-stream"
    assert r.headers.get("x-pdfhorse-anchor") == "stub"
    assert r.content.startswith(b"PDFHORSE-OTS-STUB")
    # Digest moet als raw bytes in de stub zitten.
    assert bytes.fromhex(VALID_SHA) in r.content


def test_anchor_502_on_calendar_http_error(monkeypatch):
    from backend import main as backend_main
    monkeypatch.setattr(backend_main, "ANCHOR_STUB", False)

    def boom(_digest):
        raise urllib.error.HTTPError(
            backend_main.OTS_CALENDAR_URL, 500, "Internal", {}, None,
        )

    monkeypatch.setattr(backend_main, "_ots_fetch", boom)
    r = client.post("/api/anchor", json={"sha256": VALID_SHA})
    assert r.status_code == 502


def test_anchor_503_on_calendar_unreachable(monkeypatch):
    from backend import main as backend_main
    monkeypatch.setattr(backend_main, "ANCHOR_STUB", False)

    def boom(_digest):
        raise urllib.error.URLError("name resolution failed")

    monkeypatch.setattr(backend_main, "_ots_fetch", boom)
    r = client.post("/api/anchor", json={"sha256": VALID_SHA})
    assert r.status_code == 503


def test_anchor_rate_limit_returns_429(monkeypatch):
    from backend import main as backend_main
    monkeypatch.setattr(backend_main, "ANCHOR_STUB", True)
    for _ in range(backend_main.ANCHOR_RATE_PER_HOUR):
        r = client.post("/api/anchor", json={"sha256": VALID_SHA})
        assert r.status_code == 200
    r = client.post("/api/anchor", json={"sha256": VALID_SHA})
    assert r.status_code == 429
