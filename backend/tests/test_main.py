"""
Unit tests for the book lookup API. Google Books API is mocked so tests are fast and stable.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

# Google Books response for ISBN 9781685781347 (Early Church Fathers Collection)
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

# Google Books response for ISBN 9780670016907 (The Grapes of Wrath)
GOOGLE_BOOKS_GRAPES_RESPONSE = {
    "kind": "books#volume",
    "id": "abc123",
    "volumeInfo": {
        "title": "The Grapes of Wrath",
        "publishedDate": "2014",
        "description": "A Pulitzer Prize-winning novel.",
        "authors": ["John Steinbeck"],
        "publisher": "Viking",
        "pageCount": 496,
        "categories": ["Fiction"],
        "imageLinks": {
            "thumbnail": "http://books.google.com/books/content?id=abc123&zoom=1&source=gbs_api",
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


def _mock_async_client(isbn: str, volume_response: dict):
    """Build a mock AsyncClient that returns a Google Books response for the given ISBN."""

    async def mock_get(url: str, *args, **kwargs):
        if "googleapis.com" in url and isbn in url:
            return _make_response(200, {"totalItems": 1, "items": [volume_response]})
        return _make_response(404, {})

    mock_instance = MagicMock()
    mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
    mock_instance.__aexit__ = AsyncMock(return_value=None)
    mock_instance.get = AsyncMock(side_effect=mock_get)
    return mock_instance


@patch("app.main.httpx.AsyncClient")
def test_get_book_by_isbn_returns_transformed_book(MockAsyncClient):
    """GET /api/books/isbn/{isbn} with mocked Google Books returns our schema."""
    MockAsyncClient.return_value = _mock_async_client("9780670016907", GOOGLE_BOOKS_GRAPES_RESPONSE)

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
    assert data["cover_url"].startswith("https://")
    assert data["subjects"] == ["Fiction"]
    assert "Pulitzer" in (data["description"] or "")


@patch("app.main.httpx.AsyncClient")
def test_get_book_by_isbn_normalizes_isbn(MockAsyncClient):
    """ISBN with spaces/dashes is normalized before lookup."""
    MockAsyncClient.return_value = _mock_async_client("9780670016907", GOOGLE_BOOKS_GRAPES_RESPONSE)

    client = TestClient(app)
    response = client.get("/api/books/isbn/978-0670-01690-7")

    assert response.status_code == 200
    assert response.json()["isbn"] == "9780670016907"


@patch("app.main.httpx.AsyncClient")
def test_get_book_by_isbn_not_found(MockAsyncClient):
    """Unknown ISBN returns 404 when Google Books has no result."""

    async def mock_get(url: str, *args, **kwargs):
        if "googleapis.com" in url:
            return _make_response(200, {"totalItems": 0, "items": []})
        return _make_response(404, {})

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
def test_get_book_by_isbn_google_books(MockAsyncClient):
    """GET /api/books/isbn/{isbn} returns schema populated from Google Books."""
    MockAsyncClient.return_value = _mock_async_client("9781685781347", GOOGLE_BOOKS_VOLUME_RESPONSE)

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
