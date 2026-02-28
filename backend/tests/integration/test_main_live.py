"""
Integration tests against the live Google Books API (with Open Library as page count supplement).

Run separately from unit tests:
    pytest -m integration -v

These tests make real HTTP requests and assert on the shape and
plausible content of responses, not exact values.

MongoDB is not used: do not set MONGODB_URI when running these tests so the
app always calls the external APIs (no cache). This keeps tests hitting the
real services every time.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

# ISBN well-covered by Google Books
LIVE_ISBN_GOOGLE = "9781685781347"


@pytest.mark.integration
def test_get_book_by_isbn_live_google():
    """GET /api/books/isbn/{isbn} against live Google Books returns our schema with real data."""
    client = TestClient(app)
    response = client.get(f"/api/books/isbn/{LIVE_ISBN_GOOGLE}")

    if response.status_code == 404:
        pytest.skip(
            "Google Books API returned no result for this ISBN (rate limit, network, or API change)"
        )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["isbn"] == LIVE_ISBN_GOOGLE
    assert "title" in data
    assert isinstance(data["authors"], list) and len(data["authors"]) >= 1
    assert "publishers" in data
    assert "publish_date" in data
    assert "cover_url" in data
    assert "subjects" in data
    assert "description" in data

    assert "Early Church" in data["title"] or "Church Fathers" in data["title"]


@pytest.mark.integration
def test_get_book_by_isbn_live_not_found():
    """Unknown ISBN returns 404 when Google Books has no result."""
    client = TestClient(app)
    response = client.get("/api/books/isbn/0000000000000")

    assert response.status_code == 404
    assert "detail" in response.json()
