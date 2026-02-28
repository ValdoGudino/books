# Book Log

A personal reading tracker. Look up books by ISBN, maintain a backlog, track reading progress, and log what you've finished.

- **Backend:** Python [FastAPI](https://fastapi.tiangolo.com/)
- **Frontend:** [Vue 3](https://vuejs.org/) with [Vite](https://vitejs.dev/)
- **Database:** MongoDB (optional — enables caching and the full reading log)
- **Book data:** [Google Books API](https://developers.google.com/books) (primary), [Open Library](https://openlibrary.org) (page count fallback)

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (optional, for MongoDB)

---

## Quick start (no database)

Without MongoDB the app still works: every ISBN lookup hits Google Books live, and the reading log (backlog, in-progress, finished, stats) is unavailable.

**1. Start the backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**2. Start the frontend** (in a separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` to the backend on port 8000.

---

## Full setup (with MongoDB and reading log)

MongoDB enables caching (repeat lookups skip the API) and the full reading log.

**1. Start MongoDB**

```bash
docker compose up -d mongo
```

This starts a MongoDB 7 container and exposes it on `localhost:27017`. Data is persisted in a Docker volume (`mongo_data`).

**2. Configure the environment**

Copy the example files and edit them:

```bash
cp .env.local.example .env.local
cp .env.secrets.example .env.secrets
```

`.env.local` — non-secret config:
```
MONGODB_URI=mongodb://localhost:27017
APP_TIMEZONE=America/Chicago  # your local timezone (default: UTC)
```

`.env.secrets` — keep this private, never commit it:
```
GOOGLE_BOOKS_API_KEY=your_key_here  # optional but recommended (see below)
```

**3. Load the env and start the backend**

With [direnv](https://direnv.net/) (recommended — vars load automatically on `cd` into the repo root):

```bash
direnv allow
cd backend
uvicorn app.main:app --reload --port 8000
```

Without direnv:

```bash
cd backend
source .venv/bin/activate
export $(grep -v '^#' ../.env.local | xargs)
export $(grep -v '^#' ../.env.secrets | xargs)
uvicorn app.main:app --reload --port 8000
```

**4. Start the frontend**

```bash
cd frontend
npm install
npm run dev
```

---

## Google Books API key

The app uses Google Books as its primary data source. Without an API key it works but may hit Google's anonymous quota limits (429 errors), especially if you look up many books.

To get a key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Enable the [Books API](https://console.cloud.google.com/apis/library/books.googleapis.com).
3. Go to **Credentials → Create credentials → API key** and copy the key.
4. Add it to `.env.secrets`:
   ```
   GOOGLE_BOOKS_API_KEY=your_key_here
   ```

---

## Running with Docker Compose (all services)

To run the backend and frontend in containers alongside MongoDB:

```bash
docker compose up -d
```

Set your Google Books API key in the environment before running:

```bash
GOOGLE_BOOKS_API_KEY=your_key_here docker compose up -d
```

| Service | URL |
|---|---|
| Frontend (Nginx) | http://localhost |
| Backend (FastAPI) | http://localhost:8000 |
| MongoDB | localhost:27017 |

---

## Features

### Look up
Enter an ISBN (10 or 13 digits) to fetch book metadata from Google Books: title, authors, cover, publisher, publish date, page count, subjects, and description. Results are cached in MongoDB so repeat lookups are instant.

### Reading log (requires MongoDB)
- **Backlog** — Add books from a lookup. Drag and drop to reorder within each group (Books / Articles / Poems).
- **Currently reading** — Track your current page and see a progress bar. Update your page with plain numbers (`144`) or relative offsets (`+20`).
- **Finished** — Books you've completed, with finish dates.
- **Stats** — Pages read and items finished this month and year, broken out by books, articles, and poems.

### Articles & Poems
Manually add articles or poems (no ISBN needed) from the Look up page.

### Edit
Click **Edit** on any item to update its title, authors, publishers, page count, dates, description, and reading status.

### View info
Click anywhere on a card to open a read-only info panel showing all metadata for that item.

### Reading calendar
The Currently reading page shows a calendar of days you logged reading activity. Click any day to manually toggle it on or off.

---

## Tests

MongoDB is never used during tests — `conftest.py` clears `MONGODB_URI` before the app loads.

**Unit tests** (fast, no network):

```bash
cd backend
source .venv/bin/activate
pytest
```

**Integration tests** (hit the live Google Books API):

```bash
cd backend
pytest -m integration -v
```

Integration tests require network access and a Google Books API key with quota available (set `GOOGLE_BOOKS_API_KEY` in your env).

---

## Project structure

```
books/
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI routes
│   │   ├── db.py         # MongoDB access layer
│   │   └── models.py     # Pydantic models
│   ├── tests/
│   │   ├── test_main.py                    # unit tests
│   │   └── integration/test_main_live.py   # integration tests
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/        # Vue page components
│       ├── composables/  # Shared state (useBookLog.js)
│       └── App.vue       # Root component + global modals
├── .env.local.example    # non-secret config template
├── .env.secrets.example  # secret config template (copy → .env.secrets, never commit)
├── .envrc                # direnv: loads .env.local and .env.secrets
└── docker-compose.yml
```
