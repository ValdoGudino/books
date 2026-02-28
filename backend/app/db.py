"""MongoDB connection and book cache. Disabled when MONGODB_URI is not set."""
import os
from datetime import date, datetime, time

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


def _get_settings_collection():
    if not MONGODB_URI:
        return None
    client = _client()
    if not client:
        return None
    return client["booklog"]["settings"]


def _normalize_date(doc: dict, key: str) -> None:
    """Convert datetime to date in place for key if present."""
    if doc.get(key) and hasattr(doc[key], "date"):
        doc[key] = doc[key].date()


_DATE_KEYS = ("finished_date", "started_date", "backlog_date", "last_progress_date")


def _doc_to_book(doc: dict) -> BookResponse:
    doc = dict(doc)
    doc.pop("_id", None)
    doc.pop("progress_events", None)  # internal, not in API response
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


async def delete_book(isbn: str) -> bool:
    """Delete the book/article document. Removes it from Read, backlog, in progress, and history. Returns True if deleted."""
    coll = _get_collection()
    if coll is None:
        return False
    result = await coll.delete_one({"isbn": isbn})
    return result.deleted_count > 0


METADATA_FIELDS = {
    "title", "authors", "publishers", "publish_date",
    "number_of_pages", "cover_url", "subjects", "description",
}


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


async def save_book_metadata(book: BookResponse) -> None:
    """Update only metadata fields for an existing book, preserving all user-specific data."""
    coll = _get_collection()
    if coll is None:
        return
    raw = book.model_dump()
    payload = {k: raw[k] for k in METADATA_FIELDS if k in raw}
    payload["last_looked_up"] = datetime.utcnow()
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
    # When user updates page number, record that day as progress activity and log delta for "pages recorded" stats
    progress_delta = None
    if "current_page" in payload:
        payload["last_progress_date"] = get_app_today()
        old_doc = await coll.find_one({"isbn": isbn}, projection={"current_page": 1})
        old_page = (old_doc.get("current_page") or 0) if old_doc else 0
        new_page = payload["current_page"]
        if isinstance(new_page, int) and new_page != old_page:
            progress_delta = new_page - old_page
    # Convert date fields for MongoDB
    for key in _DATE_KEYS:
        if key in payload and payload[key] is not None:
            payload[key] = _date_to_datetime(payload[key])
    update_op: dict = {"$set": payload}
    if progress_delta is not None:
        today_dt = _date_to_datetime(get_app_today())
        update_op["$push"] = {"progress_events": {"date": today_dt, "delta": progress_delta}}
    await coll.update_one({"isbn": isbn}, update_op)
    doc = await coll.find_one({"isbn": isbn})
    return _doc_to_book(doc) if doc else None


async def get_stats(as_of_date: date | None = None) -> dict:
    """Return pages_this_month, pages_this_year, books_finished_count, items_finished_count.
    If as_of_date is given (YYYY-MM-DD from client), use it for 'this month/year'; otherwise use app timezone."""
    coll = _get_collection()
    if coll is None:
        return {"pages_this_month": 0, "pages_this_year": 0, "books_finished_count": 0, "items_finished_count": 0}
    if as_of_date is not None:
        start_of_month = date(as_of_date.year, as_of_date.month, 1)
        start_of_year = date(as_of_date.year, 1, 1)
        from calendar import monthrange
        end_of_month = date(as_of_date.year, as_of_date.month, monthrange(as_of_date.year, as_of_date.month)[1])
        end_of_year = date(as_of_date.year, 12, 31)
    else:
        now = get_app_now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).date()
        start_of_year = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0).date()
        from calendar import monthrange
        end_of_month = date(now.year, now.month, monthrange(now.year, now.month)[1])
        end_of_year = date(now.year, 12, 31)
    finished = await coll.find({"status": "finished"}).to_list(length=None)
    items_count = len(finished)
    pages_from_finished_month = 0
    pages_from_finished_year = 0
    for doc in finished:
        fd = doc.get("finished_date")
        num_pages = doc.get("number_of_pages") or 0
        if not isinstance(num_pages, int):
            continue
        if fd is None:
            continue
        fd_date = fd.date() if hasattr(fd, "date") else fd
        if fd_date >= start_of_month:
            pages_from_finished_month += num_pages
        if fd_date >= start_of_year:
            pages_from_finished_year += num_pages

    # Pages recorded this month/year (from progress updates, any page delta logged in that period)
    pages_recorded_month = 0
    pages_recorded_year = 0
    cursor = coll.find({"progress_events": {"$exists": True, "$ne": []}}, projection={"progress_events": 1})
    async for doc in cursor:
        for ev in doc.get("progress_events") or []:
            ed = ev.get("date")
            delta = ev.get("delta") or 0
            if not isinstance(delta, int):
                continue
            ed_date = ed.date() if hasattr(ed, "date") else (ed[:10] if isinstance(ed, str) else None)
            if ed_date is None:
                continue
            if hasattr(ed_date, "isoformat"):
                ed_str = ed_date.isoformat()
            else:
                ed_str = str(ed_date)[:10]
            if start_of_month.isoformat() <= ed_str <= end_of_month.isoformat():
                pages_recorded_month += delta
            if start_of_year.isoformat() <= ed_str <= end_of_year.isoformat():
                pages_recorded_year += delta

    return {
        "pages_this_month": pages_from_finished_month,
        "pages_this_year": pages_from_finished_year,
        "pages_from_finished_this_month": pages_from_finished_month,
        "pages_from_finished_this_year": pages_from_finished_year,
        "pages_recorded_this_month": pages_recorded_month,
        "pages_recorded_this_year": pages_recorded_year,
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


async def get_calendar_overrides() -> dict[str, bool]:
    """Return manual calendar overrides: date_str -> True (show) or False (hide). Overrides have final say in UI."""
    settings = _get_settings_collection()
    if settings is None:
        return {}
    doc = await settings.find_one({"_id": "calendar_overrides"})
    if not doc or "overrides" not in doc:
        return {}
    return dict(doc["overrides"])


async def set_calendar_override(date_str: str, show: bool | None) -> None:
    """Set manual override for a date. show=True force-show, show=False force-hide, show=None clear override."""
    settings = _get_settings_collection()
    if settings is None:
        return
    if len(date_str) < 10:
        return
    date_str = date_str[:10]
    if show is None:
        await settings.update_one(
            {"_id": "calendar_overrides"},
            {"$unset": {f"overrides.{date_str}": ""}},
            upsert=True,
        )
    else:
        await settings.update_one(
            {"_id": "calendar_overrides"},
            {"$set": {f"overrides.{date_str}": show}},
            upsert=True,
        )


async def get_reading_activity_dates() -> list[str]:
    """Return sorted list of YYYY-MM-DD dates to show on calendar. Merges computed activity with manual overrides (overrides have final say)."""
    coll = _get_collection()
    if coll is None:
        computed: set[str] = set()
    else:
        await _clear_future_activity_dates()
        computed = set()
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
                        computed.add(date_str)
                elif isinstance(d, str) and len(d) >= 10:
                    date_str = d[:10]
                    if date_str <= today_str:
                        computed.add(date_str)

    overrides = await get_calendar_overrides()
    result = set(computed)
    for d, show in overrides.items():
        if show:
            result.add(d)
        else:
            result.discard(d)
    return sorted(result)


async def get_month_summary(year: int, month: int) -> dict:
    """Return stats and items for a given calendar month (month 1-12).
    Returns: pages_read, items_finished (list of BookResponse), dates (YYYY-MM-DD in that month with activity).
    """
    coll = _get_collection()
    if coll is None:
        return {"pages_read": 0, "items_finished": [], "dates": []}
    from calendar import monthrange
    start_day = date(year, month, 1)
    last_day = monthrange(year, month)[1]
    end_day = date(year, month, last_day)
    start_str = start_day.isoformat()
    end_str = end_day.isoformat()

    # Items finished in this month (finished_date within month range)
    end_of_day = datetime.combine(end_day, time(23, 59, 59, 999999))
    cursor = coll.find({
        "status": "finished",
        "finished_date": {"$gte": _date_to_datetime(start_day), "$lte": end_of_day},
    })
    items_finished = [_doc_to_book(d) async for d in cursor]
    pages_read = sum(
        (doc.number_of_pages or 0) for doc in items_finished
        if isinstance(doc.number_of_pages, int)
    )

    # Activity dates in this month (started, finished, or progress)
    dates_in_month: set[str] = set()
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
            elif isinstance(d, str) and len(d) >= 10:
                date_str = d[:10]
            else:
                continue
            if start_str <= date_str <= end_str:
                dates_in_month.add(date_str)

    # Pages recorded this month (progress update deltas)
    pages_recorded = 0
    cursor = coll.find({"progress_events": {"$exists": True, "$ne": []}}, projection={"progress_events": 1})
    async for doc in cursor:
        for ev in doc.get("progress_events") or []:
            ed = ev.get("date")
            delta = ev.get("delta") or 0
            if not isinstance(delta, int):
                continue
            ed_date = ed.date() if hasattr(ed, "date") else None
            if ed_date is None and isinstance(ed, str):
                ed_date = ed[:10]
            if ed_date is not None:
                ed_str = ed_date.isoformat() if hasattr(ed_date, "isoformat") else str(ed_date)[:10]
                if start_str <= ed_str <= end_str:
                    pages_recorded += delta

    return {
        "pages_read": pages_read,
        "pages_recorded": pages_recorded,
        "items_finished": items_finished,
        "dates": sorted(dates_in_month),
    }
