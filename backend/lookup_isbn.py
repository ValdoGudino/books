"""
Quick ISBN lookup from Google Books API.

Usage:
    .venv/bin/python lookup_isbn.py 9780670016907
    GOOGLE_BOOKS_API_KEY=... .venv/bin/python lookup_isbn.py 9780670016907
"""
import json
import os
import sys

import httpx


def lookup(isbn: str) -> None:
    isbn = isbn.replace("-", "").replace(" ", "").strip()
    url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"
    key = os.environ.get("GOOGLE_BOOKS_API_KEY", "").strip()
    if key:
        url = f"{url}&key={key}"

    resp = httpx.get(url, timeout=15.0, follow_redirects=True)
    resp.raise_for_status()
    data = resp.json()

    items = data.get("items") or []
    if not items:
        print(f"No results found for ISBN {isbn}")
        return

    vi = items[0].get("volumeInfo", {})
    print(json.dumps(vi, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python lookup_isbn.py <isbn>")
        sys.exit(1)
    lookup(sys.argv[1])
