"""
Migration script: re-fetch book metadata from Google Books for all ISBN entries in MongoDB.

Reading log fields (status, current_page, finished_date, backlog_order, etc.) are preserved.
Only metadata fields are overwritten: title, authors, publishers, publish_date,
number_of_pages, cover_url, subjects, description.

Usage:
    MONGODB_URI=mongodb://... python migrate_to_google_books.py

Optional env vars:
    GOOGLE_BOOKS_API_KEY  — set to avoid rate limiting
    DRY_RUN=1             — print what would be updated without writing to DB
"""
import asyncio
import os
import sys

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URI = os.environ.get("MONGODB_URI", "").strip()
GOOGLE_BOOKS_API_KEY = os.environ.get("GOOGLE_BOOKS_API_KEY", "").strip()
DRY_RUN = os.environ.get("DRY_RUN", "").strip() == "1"

METADATA_FIELDS = ("title", "authors", "publishers", "publish_date",
                   "number_of_pages", "cover_url", "subjects", "description")


def _google_books_url(isbn: str) -> str:
    url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"
    if GOOGLE_BOOKS_API_KEY:
        url = f"{url}&key={GOOGLE_BOOKS_API_KEY}"
    return url


def _extract_metadata(item: dict, isbn: str) -> dict | None:
    vi = item.get("volumeInfo") or {}
    title = vi.get("title", "Unknown") or "Unknown"
    authors = list(vi.get("authors") or []) or ["Unknown"]
    publisher = vi.get("publisher")
    publishers = [publisher] if publisher else []
    image_links = vi.get("imageLinks") or {}
    thumbnail = image_links.get("thumbnail") or image_links.get("smallThumbnail")
    if thumbnail and thumbnail.startswith("http:"):
        thumbnail = "https:" + thumbnail[5:]
    categories = list(vi.get("categories") or [])
    page_count = vi.get("pageCount")
    if page_count is not None and not isinstance(page_count, int):
        page_count = None
    description = vi.get("description")
    if isinstance(description, str):
        description = description.strip() or None

    return {
        "title": title,
        "authors": authors,
        "publishers": publishers,
        "publish_date": vi.get("publishedDate"),
        "number_of_pages": page_count,
        "cover_url": thumbnail,
        "subjects": categories,
        "description": description,
    }


async def fetch_google_books(client: httpx.AsyncClient, isbn: str) -> dict | None:
    try:
        resp = await client.get(_google_books_url(isbn), timeout=15.0)
        if resp.status_code != 200:
            return None
        data = resp.json()
        items = data.get("items") or []
        if not items:
            return None
        return _extract_metadata(items[0], isbn)
    except Exception as e:
        print(f"  [error] HTTP error for {isbn}: {e}")
        return None


async def main():
    if not MONGODB_URI:
        print("Error: MONGODB_URI environment variable is not set.")
        sys.exit(1)

    if DRY_RUN:
        print("=== DRY RUN — no changes will be written ===\n")

    client_mongo = AsyncIOMotorClient(MONGODB_URI)
    coll = client_mongo["booklog"]["books"]

    # Fetch all ISBNs that are real book ISBNs (not article- entries)
    cursor = coll.find(
        {"isbn": {"$not": {"$regex": "^article-"}}},
        projection={"isbn": 1},
    )
    isbn_list = [doc["isbn"] async for doc in cursor]

    total = len(isbn_list)
    print(f"Found {total} book ISBN(s) to migrate.\n")

    if total == 0:
        print("Nothing to do.")
        return

    updated = 0
    skipped = 0
    failed = 0

    headers = {"User-Agent": "BookLog/1.0 (migration script)"}
    async with httpx.AsyncClient(follow_redirects=True, headers=headers) as http:
        for i, isbn in enumerate(isbn_list, 1):
            print(f"[{i}/{total}] {isbn} ...", end=" ", flush=True)
            metadata = await fetch_google_books(http, isbn)
            if metadata is None:
                print("NOT FOUND on Google Books — skipped")
                skipped += 1
                continue

            print(f"→ \"{metadata['title']}\"", end=" ")
            if DRY_RUN:
                print("(dry run)")
            else:
                await coll.update_one(
                    {"isbn": isbn},
                    {"$set": metadata},
                )
                print("✓ updated")
            updated += 1

            # Small delay to be polite to the API
            await asyncio.sleep(0.3)

    print(f"\nDone. {updated} updated, {skipped} not found on Google Books, {failed} errors.")
    if DRY_RUN:
        print("(Dry run — no changes were written to MongoDB.)")


if __name__ == "__main__":
    asyncio.run(main())
