"""Pydantic models for book data and API responses."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


BookStatus = Literal["backlog", "in_progress", "finished"]
EntryType = Literal["book", "article", "poem"]


class BookResponse(BaseModel):
    """Book or article data as returned by the API (single lookup and list items)."""
    isbn: str  # For books: ISBN; for articles: "article-<uuid>"
    entry_type: EntryType = "book"
    title: str = "Unknown"
    authors: list[str] = Field(default_factory=lambda: ["Unknown"])
    publishers: list[str] = Field(default_factory=list)
    publish_date: str | None = None
    number_of_pages: int | None = None
    cover_url: str | None = None
    subjects: list[str] = Field(default_factory=list)
    description: str | None = None
    last_looked_up: datetime | None = None
    # Reading log fields
    status: BookStatus | None = None
    backlog_order: int | None = None
    backlog_date: date | None = None
    started_date: date | None = None
    current_page: int | None = None
    last_progress_date: date | None = None  # last day user updated page number
    finished_date: date | None = None


class BookDocument(BookResponse):
    """Book as stored in MongoDB (same as response + last_looked_up required for storage)."""
    last_looked_up: datetime = Field(default_factory=datetime.utcnow)


class BookUpdate(BaseModel):
    """Optional fields for PATCH /api/books/{isbn} (edit metadata or update status)."""
    title: str | None = None
    authors: list[str] | None = None
    publishers: list[str] | None = None
    publish_date: str | None = None
    number_of_pages: int | None = None
    cover_url: str | None = None
    subjects: list[str] | None = None
    description: str | None = None
    status: BookStatus | None = None
    started_date: date | None = None
    backlog_date: date | None = None
    current_page: int | None = None
    finished_date: date | None = None


class AddToBacklogBody(BaseModel):
    """Body for POST /api/books/backlog."""
    isbn: str


class BacklogOrderUpdate(BaseModel):
    """Body for PUT /api/books/backlog/order."""
    isbns: list[str]


class CreateArticleBody(BaseModel):
    """Body for POST /api/articles (manual article or poem entry)."""
    title: str
    entry_type: Literal["article", "poem"] = "article"
    authors: list[str] | None = None
    publishers: list[str] | None = None
    publish_date: str | None = None
    number_of_pages: int | None = None
    description: str | None = None
    status: BookStatus | None = "backlog"
