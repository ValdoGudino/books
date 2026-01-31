"""
Integration tests against the live Open Library and Google Books APIs.

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


# Known-good ISBN: The Grapes of Wrath 75th Anniversary (Open Library)
LIVE_ISBN_OPEN_LIBRARY = "9780670016907"

# ISBN not in Open Library but in Google Books (Early Church Fathers Collection – fallback path)
LIVE_ISBN_GOOGLE_FALLBACK = "9781685781347"


@pytest.mark.integration
def test_get_book_by_isbn_live_open_library():
    """GET /api/books/isbn/{isbn} against live Open Library returns our schema with real data."""
    client = TestClient(app)
    response = client.get(f"/api/books/isbn/{LIVE_ISBN_OPEN_LIBRARY}")

    assert response.status_code == 200
    data = response.json()

    assert "isbn" in data
    assert data["isbn"] == LIVE_ISBN_OPEN_LIBRARY
    assert "title" in data
    assert "authors" in data
    assert isinstance(data["authors"], list)
    assert len(data["authors"]) >= 1
    assert "publishers" in data
    assert "publish_date" in data
    assert "number_of_pages" in data
    assert "cover_url" in data
    assert "subjects" in data
    assert "description" in data

    # Plausible content for this known book (avoid brittle exact matches)
    assert "Grapes" in data["title"] or "Wrath" in data["title"]
    assert any("Steinbeck" in a for a in data["authors"])


@pytest.mark.integration
def test_get_book_by_isbn_live_google_fallback():
    """GET /api/books/isbn/{isbn} for ISBN not in Open Library uses Google Books fallback (9781685781347)."""
    client = TestClient(app)
    response = client.get(f"/api/books/isbn/{LIVE_ISBN_GOOGLE_FALLBACK}")

    if response.status_code == 404:
        pytest.skip(
            "Google Books API returned no result for this ISBN (rate limit, network, or API change)"
        )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["isbn"] == LIVE_ISBN_GOOGLE_FALLBACK
    assert "title" in data
    assert "authors" in data
    assert isinstance(data["authors"], list)
    assert "publishers" in data
    assert "publish_date" in data
    assert "number_of_pages" in data
    assert "cover_url" in data
    assert "subjects" in data
    assert "description" in data

    # Plausible content for Early Church Fathers Collection (from Google Books)
    assert "Early Church" in data["title"] or "Church Fathers" in data["title"]


@pytest.mark.integration
def test_get_book_by_isbn_live_not_found():
    """Unknown ISBN returns 404 from live Open Library."""
    client = TestClient(app)
    response = client.get("/api/books/isbn/0000000000000")

    assert response.status_code == 404
    assert "detail" in response.json()
