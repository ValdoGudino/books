"""
Unit tests for the book lookup API. Open Library is mocked so tests are fast and stable.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

# Example Open Library response for ISBN 9780670016907 (The Grapes of Wrath 75th Anniversary)
OPEN_LIBRARY_BOOK_RESPONSE = {
    "publishers": ["Viking"],
    "covers": [12715891],
    "physical_format": "hardcover",
    "full_title": "The Grapes of Wrath 75th Anniversary Edition",
    "key": "/books/OL28349077M",
    "authors": [{"key": "/authors/OL25788A"}],
    "source_records": [
        "amazon:067001690X",
        "marc:marc_loc_2016/BooksAll.2016.part41.utf8:267615119:1048",
    ],
    "title": "The Grapes of Wrath",
    "notes": "Source title: The Grapes of Wrath: 75th Anniversary Edition",
    "number_of_pages": 496,
    "publish_date": "2014",
    "works": [{"key": "/works/OL23205W"}],
    "type": {"key": "/type/edition"},
    "identifiers": {},
    "classifications": {},
    "languages": [{"key": "/languages/eng"}],
    "edition_name": "75th Anniversary Edition",
    "isbn_10": ["067001690X"],
    "isbn_13": ["9780670016907"],
    "lccn": ["2014381538", "bl2014008634"],
    "ocaid": "grapesofwrath0000unse_b4m4",
    "lc_classifications": ["PS3537.T3234 G8 2014", "PS3537.T3234G8 2014"],
    "oclc_numbers": ["875270180"],
    "local_id": ["urn:bwbsku:P7-CHF-758"],
    "latest_revision": 11,
    "revision": 11,
    "created": {"type": "/type/datetime", "value": "2020-07-19T15:38:37.492591"},
    "last_modified": {"type": "/type/datetime", "value": "2022-12-08T05:00:43.621675"},
}

# Author name returned by Open Library for /authors/OL25788A (John Steinbeck)
OPEN_LIBRARY_AUTHOR_RESPONSE = {"name": "John Steinbeck"}

# Google Books fallback response for ISBN 9781685781347 (Early Church Fathers Collection)
GOOGLE_BOOKS_VOLUME_RESPONSE = {
    "kind": "books#volume",
    "id": "Pghc0QEACAAJ",
    "volumeInfo": {
        "title": "Early Church Fathers Collection",
        "publishedDate": "2024",
        "description": "The Early Church Fathers Collection from Word on Fire Classics...",
        "authors": ["Word on Fire"],
        "publisher": "Word on Fire",
        "pageCount": 0,
        "categories": ["Apostolic Fathers"],
        "imageLinks": {
            "thumbnail": "http://books.google.com/books/content?id=Pghc0QEACAAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        },
    },
}


def _make_response(status_code: int, json_data: dict):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json = MagicMock(return_value=json_data)
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        resp.raise_for_status.side_effect = Exception("HTTP error")
    return resp


def _mock_async_client():
    """Build a mock AsyncClient that returns our canned Open Library responses."""

    async def mock_get(url: str, *args, **kwargs):
        if "openlibrary.org/isbn/9780670016907.json" in url or url.endswith("/isbn/9780670016907.json"):
            return _make_response(200, OPEN_LIBRARY_BOOK_RESPONSE)
        if "openlibrary.org/authors/OL25788A.json" in url or "/authors/OL25788A.json" in url:
            return _make_response(200, OPEN_LIBRARY_AUTHOR_RESPONSE)
        return _make_response(404, {})

    mock_instance = MagicMock()
    mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
    mock_instance.__aexit__ = AsyncMock(return_value=None)
    mock_instance.get = AsyncMock(side_effect=mock_get)
    return mock_instance


@patch("app.main.httpx.AsyncClient")
def test_get_book_by_isbn_returns_transformed_book(MockAsyncClient):
    """GET /api/books/isbn/{isbn} with mocked Open Library returns our schema."""
    MockAsyncClient.return_value = _mock_async_client()

    client = TestClient(app)
    response = client.get("/api/books/isbn/9780670016907")

    assert response.status_code == 200
    data = response.json()
    assert data["isbn"] == "9780670016907"
    assert data["title"] == "The Grapes of Wrath"
    assert data["authors"] == ["John Steinbeck"]
    assert data["publishers"] == ["Viking"]
    assert data["publish_date"] == "2014"
    assert data["number_of_pages"] == 496
    assert data["cover_url"] == "https://covers.openlibrary.org/b/id/12715891-M.jpg"
    assert data["subjects"] == []
    assert data["description"] is None


@patch("app.main.httpx.AsyncClient")
def test_get_book_by_isbn_normalizes_isbn(MockAsyncClient):
    """ISBN with spaces/dashes is normalized before lookup."""
    MockAsyncClient.return_value = _mock_async_client()

    client = TestClient(app)
    response = client.get("/api/books/isbn/978-0670-01690-7")

    assert response.status_code == 200
    assert response.json()["isbn"] == "9780670016907"


@patch("app.main.httpx.AsyncClient")
def test_get_book_by_isbn_not_found(MockAsyncClient):
    """Unknown ISBN returns 404 when Open Library 404s and Google Books has no result."""

    async def mock_get(url: str, *args, **kwargs):
        if "openlibrary.org" in url:
            resp = MagicMock()
            resp.status_code = 404
            resp.raise_for_status = MagicMock(side_effect=Exception("404"))
            return resp
        if "googleapis.com" in url:
            return _make_response(200, {"totalItems": 0, "items": []})
        resp = MagicMock()
        resp.status_code = 404
        return resp

    mock_instance = MagicMock()
    mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
    mock_instance.__aexit__ = AsyncMock(return_value=None)
    mock_instance.get = AsyncMock(side_effect=mock_get)
    MockAsyncClient.return_value = mock_instance

    client = TestClient(app)
    response = client.get("/api/books/isbn/9999999999999")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@patch("app.main.httpx.AsyncClient")
def test_get_book_by_isbn_fallback_google_books(MockAsyncClient):
    """When Open Library 404s, fallback to Google Books returns our schema."""

    async def mock_get(url: str, *args, **kwargs):
        if "openlibrary.org" in url:
            resp = MagicMock()
            resp.status_code = 404
            resp.raise_for_status = MagicMock(side_effect=Exception("404"))
            return resp
        if "googleapis.com" in url:
            return _make_response(
                200,
                {"totalItems": 1, "items": [GOOGLE_BOOKS_VOLUME_RESPONSE]},
            )
        return _make_response(404, {})

    mock_instance = MagicMock()
    mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
    mock_instance.__aexit__ = AsyncMock(return_value=None)
    mock_instance.get = AsyncMock(side_effect=mock_get)
    MockAsyncClient.return_value = mock_instance

    client = TestClient(app)
    response = client.get("/api/books/isbn/9781685781347")

    assert response.status_code == 200
    data = response.json()
    assert data["isbn"] == "9781685781347"
    assert data["title"] == "Early Church Fathers Collection"
    assert data["authors"] == ["Word on Fire"]
    assert data["publishers"] == ["Word on Fire"]
    assert data["publish_date"] == "2024"
    assert data["subjects"] == ["Apostolic Fathers"]
    assert "Early Church Fathers" in (data["description"] or "")


def test_get_book_by_isbn_invalid_isbn():
    """Invalid ISBN (non-digits) returns 400."""
    client = TestClient(app)
    response = client.get("/api/books/isbn/not-an-isbn")

    assert response.status_code == 400
    assert "invalid" in response.json()["detail"].lower()
