import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx

from app import db
from app.models import BookResponse

app = FastAPI(title="Book Log API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def normalize_isbn(isbn: str) -> str:
    """Strip spaces and dashes from ISBN."""
    return isbn.replace(" ", "").replace("-", "").strip()


def _extract_description(desc):
    """Open Library may return description as string or {type: ..., value: ...}."""
    if desc is None:
        return None
    if isinstance(desc, str):
        return desc
    if isinstance(desc, dict) and "value" in desc:
        return desc["value"]
    return str(desc)


def _book_from_open_library(data: dict, isbn: str) -> dict:
    """Build our response dict from Open Library edition JSON."""
    title = data.get("title", "Unknown")
    authors_raw = data.get("authors", [])
    author_keys = [a.get("key") for a in authors_raw if isinstance(a, dict) and a.get("key")]

    publishers = data.get("publishers", [])
    publish_date = data.get("publish_date")
    number_of_pages = data.get("number_of_pages")
    covers = data.get("covers") or []
    cover_id = covers[0] if covers else None
    cover_url = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg" if cover_id else None

    subjects = data.get("subjects", [])
    if subjects and isinstance(subjects[0], dict):
        subject_names = [s.get("name", s) for s in subjects[:10]]
    else:
        subject_names = list(subjects)[:10] if isinstance(subjects, list) else []

    return {
        "isbn": isbn,
        "title": title,
        "author_keys": author_keys,
        "publishers": publishers,
        "publish_date": publish_date,
        "number_of_pages": number_of_pages,
        "cover_url": cover_url,
        "subjects": subject_names,
        "description": _extract_description(data.get("description")),
    }


def _book_from_google_books(item: dict, isbn: str) -> dict:
    """Build our response dict from Google Books volume item."""
    vi = item.get("volumeInfo") or {}
    authors = vi.get("authors") or []
    publisher = vi.get("publisher")
    publishers = [publisher] if publisher else []
    image_links = vi.get("imageLinks") or {}
    thumbnail = image_links.get("thumbnail") or image_links.get("smallThumbnail")
    if thumbnail and thumbnail.startswith("http:"):
        thumbnail = "https:" + thumbnail[5:]
    categories = vi.get("categories") or []
    page_count = vi.get("pageCount")
    if page_count is not None and not isinstance(page_count, int):
        page_count = None

    return _normalize_book_response(
        isbn=isbn,
        title=vi.get("title", "Unknown"),
        authors=authors,
        publishers=publishers,
        publish_date=vi.get("publishedDate"),
        number_of_pages=page_count,
        cover_url=thumbnail,
        subjects=categories,
        description=vi.get("description"),
    )


def _normalize_book_response(
    *,
    isbn: str,
    title: str,
    authors: list,
    publishers: list,
    publish_date,
    number_of_pages,
    cover_url,
    subjects: list,
    description,
) -> dict:
    """Single response shape for both Open Library and Google Books."""
    return {
        "isbn": isbn,
        "title": title or "Unknown",
        "authors": list(authors) if authors else ["Unknown"],
        "publishers": list(publishers) if publishers else [],
        "publish_date": publish_date,
        "number_of_pages": number_of_pages,
        "cover_url": cover_url,
        "subjects": list(subjects) if subjects else [],
        "description": description.strip() if isinstance(description, str) and description.strip() else (description or None),
    }


def _description_empty(desc) -> bool:
    """True if description is missing or only whitespace."""
    if desc is None:
        return True
    if isinstance(desc, str):
        return not desc.strip()
    return True


def _google_books_url(isbn: str) -> str:
    """Google Books volumes URL for this ISBN. Uses API key from env if set (avoids blocking)."""
    url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"
    key = os.environ.get("GOOGLE_BOOKS_API_KEY", "").strip()
    if key:
        url = f"{url}&key={key}"
    return url


async def _fetch_google_books_by_isbn(client: httpx.AsyncClient, isbn: str) -> dict | None:
    """Fetch first volume from Google Books by ISBN. Returns volume item or None."""
    url = _google_books_url(isbn)
    resp = await client.get(url, timeout=15.0)
    if resp.status_code != 200:
        return None
    data = resp.json()
    items = data.get("items") or []
    return items[0] if items else None


def _enrich_from_google_books(response: dict, gb_item: dict) -> None:
    """Fill in missing/empty fields in response from Google Books volume. Mutates response."""
    vi = gb_item.get("volumeInfo") or {}
    if _description_empty(response.get("description")) and vi.get("description"):
        response["description"] = vi.get("description")
    if not response.get("cover_url"):
        links = vi.get("imageLinks") or {}
        thumb = links.get("thumbnail") or links.get("smallThumbnail")
        if thumb:
            response["cover_url"] = thumb if thumb.startswith("https:") else "https:" + thumb[5:]
    if response.get("number_of_pages") is None and vi.get("pageCount") is not None:
        response["number_of_pages"] = vi.get("pageCount")
    if not response.get("subjects") and vi.get("categories"):
        response["subjects"] = list(vi["categories"])


@app.get("/api/books/isbn/{isbn}")
async def get_book_by_isbn(isbn: str):
    """
    Look up a book by ISBN. Uses MongoDB cache when MONGODB_URI is set; otherwise calls APIs.
    Tries Open Library first, then Google Books as fallback.
    Accepts ISBN-10 or ISBN-13.
    """
    isbn = normalize_isbn(isbn)
    if not isbn or not isbn.isdigit():
        raise HTTPException(status_code=400, detail="Invalid ISBN: must contain only digits (and optional spaces/dashes)")

    # Return from cache when DB is enabled (integration tests do not set MONGODB_URI)
    if db.is_db_enabled():
        cached = await db.get_book_by_isbn(isbn)
        if cached is not None:
            await db.touch_book_last_looked_up(isbn)
            return cached.model_dump(mode="json")

    headers = {"User-Agent": "BookLog/1.0 (https://github.com/your-org/books)"}
    async with httpx.AsyncClient(follow_redirects=True, headers=headers) as client:
        # Try Open Library first
        url = f"https://openlibrary.org/isbn/{isbn}.json"
        resp = await client.get(url)
        if resp.status_code == 200:
            data = resp.json()
            book = _book_from_open_library(data, isbn)
            # Resolve author names from Open Library
            authors = []
            for key in book["author_keys"][:5]:
                try:
                    author_resp = await client.get(f"https://openlibrary.org{key}.json")
                    if author_resp.status_code == 200:
                        author_data = author_resp.json()
                        authors.append(author_data.get("name", "Unknown"))
                except Exception:
                    pass
            if not authors and data.get("authors"):
                authors = [str(a) for a in data["authors"][:5]]
            # Single response shape for the frontend
            response = _normalize_book_response(
                isbn=isbn,
                title=book["title"],
                authors=authors or ["Unknown"],
                publishers=book["publishers"],
                publish_date=book["publish_date"],
                number_of_pages=book["number_of_pages"],
                cover_url=book["cover_url"],
                subjects=book["subjects"],
                description=book["description"],
            )
            # If Open Library has no description, try Google Books to fill it (and other gaps)
            if _description_empty(response["description"]):
                gb_item = await _fetch_google_books_by_isbn(client, isbn)
                if gb_item:
                    _enrich_from_google_books(response, gb_item)
            if db.is_db_enabled():
                await db.save_book(BookResponse(**response))
            return response

        if resp.status_code == 404:
            # Fallback: Google Books API (set GOOGLE_BOOKS_API_KEY if requests are blocked)
            gb_resp = await client.get(_google_books_url(isbn), timeout=15.0)
            if gb_resp.status_code != 200:
                raise HTTPException(status_code=404, detail="Book not found for this ISBN")
            gb_data = gb_resp.json()
            total = gb_data.get("totalItems", 0)
            items = gb_data.get("items") or []
            if total < 1 or not items:
                raise HTTPException(status_code=404, detail="Book not found for this ISBN")
            result = _book_from_google_books(items[0], isbn)
            if db.is_db_enabled():
                await db.save_book(BookResponse(**result))
            return result

        resp.raise_for_status()
    raise HTTPException(status_code=404, detail="Book not found for this ISBN")


@app.get("/api/books/history")
async def list_history(limit: int = 20):
    """Return recent book lookups (when MongoDB is enabled). Ordered by last lookup time."""
    items = await db.get_history(limit=limit)
    return [b.model_dump(mode="json") for b in items]
