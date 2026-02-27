"""
Quick ISBN lookup from Open Library API.

Usage:
    .venv/bin/python lookup_isbn_ol.py 9780670016907
"""
import json
import sys

import httpx


def lookup(isbn: str) -> None:
    isbn = isbn.replace("-", "").replace(" ", "").strip()
    headers = {"User-Agent": "BookLog/1.0 (lookup script)"}

    resp = httpx.get(
        f"https://openlibrary.org/isbn/{isbn}.json",
        headers=headers,
        timeout=15.0,
        follow_redirects=True,
    )

    if resp.status_code == 404:
        print(f"No result found for ISBN {isbn} on Open Library")
        return

    resp.raise_for_status()
    data = resp.json()

    # Resolve author names
    authors_raw = data.get("authors") or []
    author_keys = [a.get("key") for a in authors_raw if isinstance(a, dict) and a.get("key")]
    resolved_authors = []
    for key in author_keys[:5]:
        try:
            a_resp = httpx.get(
                f"https://openlibrary.org{key}.json",
                headers=headers,
                timeout=15.0,
                follow_redirects=True,
            )
            if a_resp.status_code == 200:
                resolved_authors.append(a_resp.json())
        except Exception:
            pass

    print("=== Edition ===")
    print(json.dumps(data, indent=2, ensure_ascii=False))

    if resolved_authors:
        print("\n=== Authors ===")
        print(json.dumps(resolved_authors, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python lookup_isbn_ol.py <isbn>")
        sys.exit(1)
    lookup(sys.argv[1])
