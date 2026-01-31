"""MongoDB connection and book cache. Disabled when MONGODB_URI is not set."""
import os
from datetime import datetime

from app.models import BookResponse

MONGODB_URI = os.environ.get("MONGODB_URI", "").strip()
COLLECTION_NAME = "books"


def _client():
    if not MONGODB_URI:
        return None
    from motor.motor_asyncio import AsyncIOMotorClient
    return AsyncIOMotorClient(MONGODB_URI)


def is_db_enabled() -> bool:
    """True if MongoDB is configured (cache and history are used)."""
    return bool(MONGODB_URI)


def _get_collection():
    if not MONGODB_URI:
        return None
    client = _client()
    if not client:
        return None
    return client["booklog"][COLLECTION_NAME]


async def get_book_by_isbn(isbn: str) -> BookResponse | None:
    """Return cached book document if present, else None."""
    coll = _get_collection()
    if coll is None:
        return None
    doc = await coll.find_one({"isbn": isbn})
    if not doc:
        return None
    doc.pop("_id", None)
    return BookResponse(**doc)


async def save_book(book: BookResponse) -> None:
    """Upsert book by ISBN and set last_looked_up to now."""
    coll = _get_collection()
    if coll is None:
        return
    now = datetime.utcnow()
    payload = book.model_dump()
    payload["last_looked_up"] = now
    await coll.update_one(
        {"isbn": book.isbn},
        {"$set": payload},
        upsert=True,
    )


async def touch_book_last_looked_up(isbn: str) -> None:
    """Set last_looked_up to now for an existing document (after serving from cache)."""
    coll = _get_collection()
    if coll is None:
        return
    await coll.update_one(
        {"isbn": isbn},
        {"$set": {"last_looked_up": datetime.utcnow()}},
    )


async def get_history(limit: int = 20) -> list[BookResponse]:
    """Return recent lookups ordered by last_looked_up descending."""
    coll = _get_collection()
    if coll is None:
        return []
    cursor = coll.find({}).sort("last_looked_up", -1).limit(limit)
    out = []
    async for doc in cursor:
        doc.pop("_id", None)
        out.append(BookResponse(**doc))
    return out
