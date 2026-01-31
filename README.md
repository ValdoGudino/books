# Book Log

A simple web app to look up books by ISBN. Enter an ISBN (10 or 13 digits) and see facts about the book from [Open Library](https://openlibrary.org).

- **Backend:** Python [FastAPI](https://fastapi.tiangolo.com/)
- **Frontend:** [Vue 3](https://vuejs.org/) with [Vite](https://vitejs.dev/)

## Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Secrets (direnv)** – To load env vars (e.g. `GOOGLE_BOOKS_API_KEY`) from a local file when you `cd backend`:

1. Install [direnv](https://direnv.net/) and hook it into your shell.
2. Copy `backend/.env.example` to `backend/.env` and add your values.
3. From the repo root or from `backend`, run `direnv allow` in `backend` (or `cd backend` and `direnv allow`).
4. After that, `cd backend` will load `.env` automatically; `cd ..` unloads it.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` to the FastAPI backend on port 8000.

**Local MongoDB (optional)** – For cached lookups and search history:

1. Start MongoDB: `docker compose up -d` (from the repo root).
2. Set `MONGODB_URI=mongodb://localhost:27017` in `backend/.env` (or via direnv).
3. Restart the backend. Looked-up books are stored by ISBN; repeat lookups are served from the DB without calling the APIs. The frontend shows a **Recent lookups** list; click an item to look it up again.

If `MONGODB_URI` is not set, the app does not use a database: every lookup calls Open Library / Google Books, and the history endpoint returns an empty list.

## Usage

1. Enter a book ISBN (e.g. `9780140328721` or `0140328721`).
2. Click **Look up**.
3. View title, authors, cover, publisher, publish date, page count, subjects, and description.

Book data is fetched from **Open Library** first; if a book isn’t found, **Google Books** is used as a fallback. Open Library requires no API key.

**If Google Books blocks your requests** (e.g. 403 or no results), use an optional API key:

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. Enable the [Books API](https://console.cloud.google.com/apis/library/books.googleapis.com).
3. Create an API key (Credentials → Create credentials → API key).
4. Set the key when running the backend:

   ```bash
   export GOOGLE_BOOKS_API_KEY=your_key_here
   uvicorn app.main:app --reload --port 8000
   ```

   Or put it in a `.env` file and load it (e.g. with `python-dotenv`) before starting the server. The app uses the key only for Google Books requests (fallback and description enrichment); Open Library is still used without a key.

## Tests

Pytest is configured so **MongoDB is never used during tests**: `conftest.py` unsets `MONGODB_URI` before the app is loaded. You can run `pytest` from the backend directory even when direnv has set `MONGODB_URI`; the DB is skipped for all test runs.

**Unit tests** (mocked, fast): validate app logic without calling Open Library.

```bash
cd backend
pip install -r requirements.txt
pytest
```

**Integration tests** (live Open Library and Google Books): run separately when you want to verify against the real services. They hit the APIs every time (no cache).

```bash
cd backend
pytest -m integration -v
```
