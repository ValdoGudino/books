"""MongoDB connection and book cache. Disabled when MONGODB_URI is not set."""
import os
from datetime import date, datetime

from app.models import BookResponse, BookUpdate

MONGODB_URI = os.environ.get("MONGODB_URI", "").strip()
COLLECTION_NAME = "books"

# Timezone for "today" and stats (e.g. America/Chicago for Central Time). Default UTC.
APP_TIMEZONE = os.environ.get("APP_TIMEZONE", "UTC").strip() or "UTC"


def _app_tz():
    from zoneinfo import ZoneInfo
    return ZoneInfo(APP_TIMEZONE)


def get_app_today() -> date:
    """Today's date in the app timezone (APP_TIMEZONE env)."""
    return datetime.now(_app_tz()).date()


def get_app_now() -> datetime:
    """Current datetime in the app timezone (for date logic like 'this month')."""
    return datetime.now(_app_tz())


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


def _normalize_date(doc: dict, key: str) -> None:
    """Convert datetime to date in place for key if present."""
    if doc.get(key) and hasattr(doc[key], "date"):
        doc[key] = doc[key].date()


_DATE_KEYS = ("finished_date", "started_date", "backlog_date", "last_progress_date")


def _doc_to_book(doc: dict) -> BookResponse:
    doc = dict(doc)
    doc.pop("_id", None)
    for key in _DATE_KEYS:
        _normalize_date(doc, key)
    return BookResponse(**doc)


async def get_book_by_isbn(isbn: str) -> BookResponse | None:
    """Return cached book document if present, else None."""
    coll = _get_collection()
    if coll is None:
        return None
    doc = await coll.find_one({"isbn": isbn})
    if not doc:
        return None
    return _doc_to_book(doc)


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
        out.append(_doc_to_book(doc))
    return out


async def get_backlog() -> list[BookResponse]:
    """Return books with status=backlog ordered by backlog_order."""
    coll = _get_collection()
    if coll is None:
        return []
    cursor = coll.find({"status": "backlog"}).sort("backlog_order", 1)
    return [_doc_to_book(d) async for d in cursor]


async def get_in_progress() -> list[BookResponse]:
    """Return books with status=in_progress ordered by last_looked_up desc."""
    coll = _get_collection()
    if coll is None:
        return []
    cursor = coll.find({"status": "in_progress"}).sort("last_looked_up", -1)
    return [_doc_to_book(d) async for d in cursor]


async def get_finished() -> list[BookResponse]:
    """Return books with status=finished ordered by finished_date desc."""
    coll = _get_collection()
    if coll is None:
        return []
    cursor = coll.find({"status": "finished"}).sort("finished_date", -1)
    return [_doc_to_book(d) async for d in cursor]


async def add_to_backlog(isbn: str, book_payload: dict) -> BookResponse | None:
    """Set book status to backlog and assign next backlog_order. Sets backlog_date to today (app timezone)."""
    coll = _get_collection()
    if coll is None:
        return None
    agg = await coll.find_one(
        {"status": "backlog"},
        sort=[("backlog_order", -1)],
        projection={"backlog_order": 1},
    )
    next_order = (agg["backlog_order"] + 1) if agg else 0
    now = datetime.utcnow()
    today = get_app_today()
    payload = {
        **book_payload,
        "isbn": isbn,
        "status": "backlog",
        "backlog_order": next_order,
        "backlog_date": today,
        "last_looked_up": now,
    }
    # MongoDB BSON doesn't support datetime.date; convert date fields to datetime
    for key in _DATE_KEYS:
        if key in payload and payload[key] is not None and hasattr(payload[key], "year"):
            payload[key] = _date_to_datetime(payload[key])
    await coll.update_one({"isbn": isbn}, {"$set": payload}, upsert=True)
    return _doc_to_book(payload)


async def create_article(article: BookResponse) -> BookResponse | None:
    """Insert a new article. If status is backlog, assign backlog_order and backlog_date (app timezone)."""
    coll = _get_collection()
    if coll is None:
        return None
    now = datetime.utcnow()
    today = get_app_today()
    payload = article.model_dump()
    payload["last_looked_up"] = now
    if payload.get("status") == "backlog":
        agg = await coll.find_one(
            {"status": "backlog"},
            sort=[("backlog_order", -1)],
            projection={"backlog_order": 1},
        )
        next_order = (agg["backlog_order"] + 1) if agg else 0
        payload["backlog_order"] = next_order
        payload["backlog_date"] = today
    elif payload.get("status") == "in_progress" and not payload.get("started_date"):
        payload["started_date"] = today
    for key in ("finished_date", "started_date", "backlog_date"):
        if key in payload and payload[key] is not None and hasattr(payload[key], "year"):
            payload[key] = _date_to_datetime(payload[key])
    await coll.insert_one(payload)
    return _doc_to_book(payload)


async def reorder_backlog(isbns: list[str]) -> None:
    """Set backlog_order by index in isbns list."""
    coll = _get_collection()
    if coll is None:
        return
    for i, isbn in enumerate(isbns):
        await coll.update_one({"isbn": isbn, "status": "backlog"}, {"$set": {"backlog_order": i}})


def _date_to_datetime(d: date) -> datetime:
    return datetime.combine(d, datetime.min.time())


async def update_book(isbn: str, update: BookUpdate) -> BookResponse | None:
    """Update book fields. When status -> in_progress and started_date unset, set to today."""
    coll = _get_collection()
    if coll is None:
        return None
    payload = update.model_dump(exclude_unset=True)
    if not payload:
        doc = await coll.find_one({"isbn": isbn})
        return _doc_to_book(doc) if doc else None
    # When moving to in_progress, set started_date to today if not already set and not provided (app timezone)
    if payload.get("status") == "in_progress" and "started_date" not in payload:
        doc = await coll.find_one({"isbn": isbn}, projection={"started_date": 1})
        if doc and doc.get("started_date") is None:
            payload["started_date"] = get_app_today()
    # When user updates page number, record that day as progress activity (app timezone)
    if "current_page" in payload:
        payload["last_progress_date"] = get_app_today()
    # Convert date fields for MongoDB
    for key in _DATE_KEYS:
        if key in payload and payload[key] is not None:
            payload[key] = _date_to_datetime(payload[key])
    await coll.update_one({"isbn": isbn}, {"$set": payload})
    doc = await coll.find_one({"isbn": isbn})
    return _doc_to_book(doc) if doc else None


async def get_stats() -> dict:
    """Return pages_this_month, pages_this_year, books_finished_count, items_finished_count (app timezone)."""
    coll = _get_collection()
    if coll is None:
        return {"pages_this_month": 0, "pages_this_year": 0, "books_finished_count": 0, "items_finished_count": 0}
    now = get_app_now()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).date()
    start_of_year = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0).date()
    finished = await coll.find({"status": "finished"}).to_list(length=None)
    items_count = len(finished)
    pages_month = 0
    pages_year = 0
    for doc in finished:
        fd = doc.get("finished_date")
        num_pages = doc.get("number_of_pages") or 0
        if not isinstance(num_pages, int):
            continue
        if fd is None:
            continue
        fd_date = fd.date() if hasattr(fd, "date") else fd
        if fd_date >= start_of_month:
            pages_month += num_pages
        if fd_date >= start_of_year:
            pages_year += num_pages
    return {
        "pages_this_month": pages_month,
        "pages_this_year": pages_year,
        "books_finished_count": items_count,
        "items_finished_count": items_count,
    }


def _doc_date_to_iso(val) -> str | None:
    """Get YYYY-MM-DD string from a doc value (datetime or str), or None."""
    if val is None:
        return None
    if hasattr(val, "date"):
        return val.date().isoformat()
    if isinstance(val, str) and len(val) >= 10:
        return val[:10]
    return None


async def _clear_future_activity_dates() -> None:
    """Remove any started_date, finished_date, or last_progress_date that is in the future (app timezone).
    So tomorrow won't show as 'read' until the user actually logs reading that day."""
    coll = _get_collection()
    if coll is None:
        return
    today_str = get_app_today().isoformat()
    cursor = coll.find(
        {
            "$or": [
                {"started_date": {"$exists": True, "$ne": None}},
                {"finished_date": {"$exists": True, "$ne": None}},
                {"last_progress_date": {"$exists": True, "$ne": None}},
            ]
        },
        projection={"isbn": 1, "started_date": 1, "finished_date": 1, "last_progress_date": 1},
    )
    async for doc in cursor:
        unset: dict[str, str] = {}
        for key in ("started_date", "finished_date", "last_progress_date"):
            date_str = _doc_date_to_iso(doc.get(key))
            if date_str is not None and date_str > today_str:
                unset[key] = ""
        if unset:
            await coll.update_one({"isbn": doc["isbn"]}, {"$unset": unset})


async def get_reading_activity_dates() -> list[str]:
    """Return sorted list of YYYY-MM-DD dates when user had reading activity (started, finished, or updated page number).
    Excludes future dates. Clears any future dates stored in the DB so tomorrow won't show as read until you log it."""
    coll = _get_collection()
    if coll is None:
        return []
    await _clear_future_activity_dates()
    dates: set[str] = set()
    today = get_app_today()
    today_str = today.isoformat()
    cursor = coll.find(
        {
            "$or": [
                {"started_date": {"$exists": True, "$ne": None}},
                {"finished_date": {"$exists": True, "$ne": None}},
                {"last_progress_date": {"$exists": True, "$ne": None}},
            ]
        },
        projection={"started_date": 1, "finished_date": 1, "last_progress_date": 1},
    )
    async for doc in cursor:
        for key in ("started_date", "finished_date", "last_progress_date"):
            val = doc.get(key)
            if val is None:
                continue
            d = val.date() if hasattr(val, "date") else val
            if hasattr(d, "isoformat"):
                date_str = d.isoformat()
                if date_str <= today_str:
                    dates.add(date_str)
            elif isinstance(d, str) and len(d) >= 10:
                date_str = d[:10]
                if date_str <= today_str:
                    dates.add(date_str)
    return sorted(dates)
