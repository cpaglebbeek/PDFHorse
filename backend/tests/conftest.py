"""Test-fixtures voor PDFHorse backend."""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _reset_mail_rate_bucket():
    """Reset de in-process rate-limit bucket vóór elke test.

    De FastAPI TestClient gebruikt één client-IP, waardoor opeenvolgende
    /api/mail-tests anders binnen één run de 5/uur-limiet overschrijden.
    """
    from backend import main as backend_main

    backend_main._mail_rate_buckets.clear()
    yield
    backend_main._mail_rate_buckets.clear()
