"""Pydantic models for book data and API responses."""
from datetime import datetime

from pydantic import BaseModel, Field


class BookResponse(BaseModel):
    """Book data as returned by the API (single lookup and history items)."""
    isbn: str
    title: str = "Unknown"
    authors: list[str] = Field(default_factory=lambda: ["Unknown"])
    publishers: list[str] = Field(default_factory=list)
    publish_date: str | None = None
    number_of_pages: int | None = None
    cover_url: str | None = None
    subjects: list[str] = Field(default_factory=list)
    description: str | None = None
    last_looked_up: datetime | None = None


class BookDocument(BookResponse):
    """Book as stored in MongoDB (same as response + last_looked_up required for storage)."""
    last_looked_up: datetime = Field(default_factory=datetime.utcnow)
