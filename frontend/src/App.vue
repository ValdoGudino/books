<script setup>
import { ref, computed, onMounted } from 'vue'

const isbn = ref('')
const book = ref(null)
const loading = ref(false)
const error = ref(null)
const history = ref([])
const backlog = ref([])
const inProgress = ref([])
const finished = ref([])
const stats = ref({ pages_this_month: 0, pages_this_year: 0, books_finished_count: 0, items_finished_count: 0 })
const editBook = ref(null) // used for finish-date modal (has isbn)
const editBookForEdit = ref(null) // full book for edit form
const finishDate = ref('')
const showFinishModal = ref(false)
const draggedIsbn = ref(null)
const draggedSection = ref(null) // 'book' | 'article' | 'poem' for backlog reorder
// Add article form
const showArticleForm = ref(false)
const articleForm = ref({ title: '', authors: '', status: 'backlog', number_of_pages: '', publish_date: '', description: '' })
const articleSubmitting = ref(false)
const articleError = ref('')
// Add poem form
const showPoemForm = ref(false)
const poemForm = ref({ title: '', authors: '', status: 'backlog', number_of_pages: '', publish_date: '', description: '' })
const poemSubmitting = ref(false)
const poemError = ref('')
// Reading activity calendar
const activityDates = ref([]) // ['YYYY-MM-DD', ...]
const calendarMonth = ref(new Date().getMonth())
const calendarYear = ref(new Date().getFullYear())
// Minimize Recent lookups (search history)
const historyMinimized = ref(false)

const canSubmit = computed(() => {
  const cleaned = (isbn.value || '').replace(/[\s-]/g, '')
  return cleaned.length >= 10 && /^\d+$/.test(cleaned)
})

const today = computed(() => new Date().toISOString().slice(0, 10))

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

async function loadHistory() {
  try {
    const res = await fetch('/api/books/history')
    if (res.ok) history.value = await res.json()
  } catch {
    history.value = []
  }
}

async function loadBacklog() {
  try {
    const res = await fetch('/api/books/backlog')
    if (res.ok) backlog.value = await res.json()
  } catch {
    backlog.value = []
  }
}

async function loadInProgress() {
  try {
    const res = await fetch('/api/books/in-progress')
    if (res.ok) inProgress.value = await res.json()
  } catch {
    inProgress.value = []
  }
}

async function loadFinished() {
  try {
    const res = await fetch('/api/books/finished')
    if (res.ok) finished.value = await res.json()
  } catch {
    finished.value = []
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/books/stats')
    if (res.ok) stats.value = await res.json()
  } catch {}
}

async function loadActivityDates() {
  try {
    const res = await fetch('/api/reading-activity/dates')
    if (res.ok) {
      const data = await res.json()
      activityDates.value = data.dates || []
    }
  } catch {
    activityDates.value = []
  }
}

async function refreshReadingLog() {
  await Promise.all([loadBacklog(), loadInProgress(), loadFinished(), loadStats(), loadActivityDates()])
}

function isArticle(item) {
  return item && item.entry_type === 'article'
}

function isPoem(item) {
  return item && item.entry_type === 'poem'
}

// Split lists by type for separate Articles / Poems sections (books = rest)
const backlogBooks = computed(() => backlog.value.filter((b) => !b.entry_type || b.entry_type === 'book'))
const backlogArticles = computed(() => backlog.value.filter((b) => b.entry_type === 'article'))
const backlogPoems = computed(() => backlog.value.filter((b) => b.entry_type === 'poem'))
const inProgressBooks = computed(() => inProgress.value.filter((b) => !b.entry_type || b.entry_type === 'book'))
const inProgressArticles = computed(() => inProgress.value.filter((b) => b.entry_type === 'article'))
const inProgressPoems = computed(() => inProgress.value.filter((b) => b.entry_type === 'poem'))
const finishedBooks = computed(() => finished.value.filter((b) => !b.entry_type || b.entry_type === 'book'))
const finishedArticles = computed(() => finished.value.filter((b) => b.entry_type === 'article'))
const finishedPoems = computed(() => finished.value.filter((b) => b.entry_type === 'poem'))

async function submitArticle() {
  const title = (articleForm.value.title || '').trim()
  if (!title) {
    articleError.value = 'Title is required'
    return
  }
  articleError.value = ''
  articleSubmitting.value = true
  try {
    const authors = articleForm.value.authors
      ? articleForm.value.authors.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined
    const body = {
      title,
      entry_type: 'article',
      authors: authors && authors.length ? authors : undefined,
      status: articleForm.value.status || 'backlog',
      number_of_pages: articleForm.value.number_of_pages ? parseInt(articleForm.value.number_of_pages, 10) : undefined,
      publish_date: (articleForm.value.publish_date || '').trim() || undefined,
      description: (articleForm.value.description || '').trim() || undefined,
    }
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail || res.statusText || 'Failed to add article')
    }
    articleForm.value = { title: '', authors: '', status: 'backlog', number_of_pages: '', publish_date: '', description: '' }
    showArticleForm.value = false
    await refreshReadingLog()
    await loadHistory()
  } catch (e) {
    articleError.value = e.message || 'Something went wrong'
  } finally {
    articleSubmitting.value = false
  }
}

async function submitPoem() {
  const title = (poemForm.value.title || '').trim()
  if (!title) {
    poemError.value = 'Title is required'
    return
  }
  poemError.value = ''
  poemSubmitting.value = true
  try {
    const authors = poemForm.value.authors
      ? poemForm.value.authors.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined
    const body = {
      title,
      entry_type: 'poem',
      authors: authors && authors.length ? authors : undefined,
      status: poemForm.value.status || 'backlog',
      number_of_pages: poemForm.value.number_of_pages ? parseInt(poemForm.value.number_of_pages, 10) : undefined,
      publish_date: (poemForm.value.publish_date || '').trim() || undefined,
      description: (poemForm.value.description || '').trim() || undefined,
    }
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail || res.statusText || 'Failed to add poem')
    }
    poemForm.value = { title: '', authors: '', status: 'backlog', number_of_pages: '', publish_date: '', description: '' }
    showPoemForm.value = false
    await refreshReadingLog()
    await loadHistory()
  } catch (e) {
    poemError.value = e.message || 'Something went wrong'
  } finally {
    poemSubmitting.value = false
  }
}

async function lookup() {
  if (!canSubmit.value) return
  error.value = null
  book.value = null
  loading.value = true
  try {
    const cleaned = isbn.value.replace(/[\s-]/g, '')
    const res = await fetch(`/api/books/isbn/${encodeURIComponent(cleaned)}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail || res.statusText || 'Book not found')
    }
    book.value = await res.json()
    await loadHistory()
    await refreshReadingLog()
  } catch (e) {
    error.value = e.message || 'Something went wrong'
  } finally {
    loading.value = false
  }
}

function lookupFromHistory(item) {
  isbn.value = item.isbn
  lookup()
}

async function addToBacklog() {
  if (!book.value?.isbn) return
  try {
    const res = await fetch('/api/books/backlog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isbn: book.value.isbn }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Failed')
    await refreshReadingLog()
  } catch (e) {
    error.value = e.message
  }
}

async function startReading(isbn) {
  try {
    const res = await fetch(`/api/books/${encodeURIComponent(isbn)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress', current_page: 0 }),
    })
    if (!res.ok) throw new Error('Failed')
    await refreshReadingLog()
  } catch {
    error.value = 'Failed to start reading'
  }
}

async function startReadingFromLookup() {
  if (!book.value?.isbn) return
  try {
    const addRes = await fetch('/api/books/backlog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isbn: book.value.isbn }),
    })
    if (!addRes.ok) throw new Error('Add failed')
    await fetch(`/api/books/${encodeURIComponent(book.value.isbn)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress', current_page: 0 }),
    })
    await refreshReadingLog()
  } catch (e) {
    error.value = e.message
  }
}

async function updateProgress(isbn, currentPage) {
  const page = parseInt(currentPage, 10)
  if (Number.isNaN(page) || page < 0) return
  try {
    const res = await fetch(`/api/books/${encodeURIComponent(isbn)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_page: page }),
    })
    if (!res.ok) return
    await loadInProgress()
    await loadActivityDates()
  } catch {}
}

function openFinishModal(isbn) {
  editBook.value = { isbn }
  finishDate.value = today.value
  showFinishModal.value = true
}

async function markFinishedFromLookup() {
  if (!book.value?.isbn) return
  editBook.value = { isbn: book.value.isbn }
  finishDate.value = today.value
  showFinishModal.value = true
}

async function confirmMarkFinished() {
  if (!editBook.value?.isbn || !finishDate.value) return
  try {
    const res = await fetch(`/api/books/${encodeURIComponent(editBook.value.isbn)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'finished', finished_date: finishDate.value }),
    })
    if (!res.ok) throw new Error('Failed')
    showFinishModal.value = false
    editBook.value = null
    await refreshReadingLog()
  } catch (e) {
    error.value = e.message
  }
}

async function removeFromList(isbn) {
  if (!confirm('Remove from list? Progress (e.g. pages read) is kept.')) return
  try {
    const res = await fetch(`/api/books/${encodeURIComponent(isbn)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: null }),
    })
    if (!res.ok) throw new Error('Failed')
    await refreshReadingLog()
  } catch (e) {
    error.value = e.message
  }
}

function progressPercent(item) {
  const total = item.number_of_pages
  const current = item.current_page ?? 0
  if (!total || total <= 0) return 0
  return Math.min(100, Math.round((current / total) * 100))
}

// Backlog drag and drop (per-section: books, articles, poems)
function backlogSectionType(item) {
  return item.entry_type === 'article' ? 'article' : item.entry_type === 'poem' ? 'poem' : 'book'
}

function onBacklogDragStart(e, item) {
  draggedIsbn.value = item.isbn
  draggedSection.value = backlogSectionType(item)
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', item.isbn)
}

function onBacklogDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

function mergeBacklogOrder(fullList, newSectionItems, sectionType) {
  let j = 0
  return fullList.map((item) => (backlogSectionType(item) === sectionType ? newSectionItems[j++] : item))
}

async function onBacklogDrop(e, sectionType, dropIndex) {
  e.preventDefault()
  const isbn = draggedIsbn.value
  const section = draggedSection.value
  draggedIsbn.value = null
  draggedSection.value = null
  if (!isbn || section !== sectionType) return
  const sectionItems =
    sectionType === 'article'
      ? backlogArticles.value
      : sectionType === 'poem'
        ? backlogPoems.value
        : backlogBooks.value
  const fromIndex = sectionItems.findIndex((i) => i.isbn === isbn)
  if (fromIndex === -1) return
  const reordered = [...sectionItems]
  const [removed] = reordered.splice(fromIndex, 1)
  reordered.splice(dropIndex, 0, removed)
  const fullOrder = mergeBacklogOrder(backlog.value, reordered, sectionType)
  try {
    await fetch('/api/books/backlog/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isbns: fullOrder.map((i) => i.isbn) }),
    })
    await loadBacklog()
  } catch {
    error.value = 'Failed to reorder'
  }
}

// Edit book
function openEdit(b) {
  editBookForEdit.value = b ? { ...b } : null
}

async function saveEdit() {
  if (!editBookForEdit.value?.isbn) return
  const b = editBookForEdit.value
  const payload = {
    title: b.title ?? undefined,
    authors: b.authors ?? undefined,
    publishers: b.publishers ?? undefined,
    publish_date: b.publish_date ?? undefined,
    number_of_pages: b.number_of_pages != null ? Number(b.number_of_pages) : undefined,
    description: b.description ?? undefined,
    started_date: b.started_date && String(b.started_date).slice(0, 10) ? String(b.started_date).slice(0, 10) : undefined,
    backlog_date: b.backlog_date && String(b.backlog_date).slice(0, 10) ? String(b.backlog_date).slice(0, 10) : undefined,
  }
  try {
    const res = await fetch(`/api/books/${encodeURIComponent(b.isbn)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed')
    editBookForEdit.value = null
    await refreshReadingLog()
    await loadHistory()
    if (book.value?.isbn === b.isbn) {
      book.value = await res.json()
    }
  } catch (e) {
    error.value = e.message
  }
}

// Calendar: days in month grid
const calendarMonthName = computed(() => {
  const d = new Date(calendarYear.value, calendarMonth.value, 1)
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
})

const calendarDays = computed(() => {
  const year = calendarYear.value
  const month = calendarMonth.value
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startPad = first.getDay() // 0 = Sunday
  const daysInMonth = last.getDate()
  const set = new Set(activityDates.value)
  const days = []
  for (let i = 0; i < startPad; i++) days.push({ empty: true })
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ day: d, dateStr, active: set.has(dateStr), empty: false })
  }
  return days
})

function calendarPrevMonth() {
  if (calendarMonth.value === 0) {
    calendarMonth.value = 11
    calendarYear.value--
  } else {
    calendarMonth.value--
  }
}

function calendarNextMonth() {
  if (calendarMonth.value === 11) {
    calendarMonth.value = 0
    calendarYear.value++
  } else {
    calendarMonth.value++
  }
}

onMounted(() => {
  loadHistory()
  refreshReadingLog()
})
</script>

<template>
  <header class="header">
    <h1 class="title">Book Log</h1>
    <p class="tagline">Look up books by ISBN and track your reading</p>
  </header>

  <div class="app-main">
    <!-- Left: Look up + search history -->
    <aside class="panel panel-left">
      <form class="form" @submit.prevent="lookup">
        <label for="isbn" class="label">ISBN (10 or 13 digits)</label>
        <div class="input-row">
          <input
            id="isbn"
            v-model="isbn"
            type="text"
            class="input"
            placeholder="e.g. 9780140328721"
            autocomplete="off"
            :disabled="loading"
          />
          <button type="submit" class="btn" :disabled="!canSubmit || loading">
            {{ loading ? 'Looking up…' : 'Look up' }}
          </button>
        </div>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
      <article v-if="book" class="book">
        <div class="book-layout">
          <div v-if="book.cover_url" class="cover-wrap">
            <img :src="book.cover_url" :alt="book.title" class="cover" />
          </div>
          <div class="details">
            <h2 class="book-title">{{ book.title }}</h2>
            <p v-if="book.authors?.length" class="meta">
              <span class="meta-label">Authors</span>
              {{ book.authors.join(', ') }}
            </p>
            <p v-if="book.publish_date" class="meta">
              <span class="meta-label">Published</span>
              {{ book.publish_date }}
            </p>
            <p v-if="book.number_of_pages" class="meta">
              <span class="meta-label">Pages</span>
              {{ book.number_of_pages }}
            </p>
            <div class="book-actions">
              <button type="button" class="btn btn-secondary" @click="addToBacklog">Add to backlog</button>
              <button type="button" class="btn btn-secondary" @click="startReadingFromLookup">Start reading</button>
              <button type="button" class="btn btn-secondary" @click="markFinishedFromLookup">Mark as finished</button>
            </div>
          </div>
        </div>
      </article>
          <section class="add-shortform">
        <button type="button" class="btn btn-secondary" @click="showArticleForm = !showArticleForm">
          {{ showArticleForm ? 'Cancel' : 'Add article' }}
        </button>
        <button type="button" class="btn btn-secondary" @click="showPoemForm = !showPoemForm">
          {{ showPoemForm ? 'Cancel' : 'Add poem' }}
        </button>
        <form v-if="showArticleForm" class="form article-form" @submit.prevent="submitArticle">
      <label class="label">Title <span class="required">*</span></label>
      <input v-model="articleForm.title" type="text" class="input" placeholder="Article title" required />
      <label class="label">Authors (comma-separated)</label>
      <input v-model="articleForm.authors" type="text" class="input" placeholder="e.g. Smith, J.; Doe, A." />
      <label class="label">Initial status</label>
      <select v-model="articleForm.status" class="input">
        <option value="backlog">Backlog</option>
        <option value="in_progress">In progress</option>
        <option value="finished">Finished</option>
      </select>
      <label class="label">Number of pages (optional)</label>
      <input v-model="articleForm.number_of_pages" type="number" min="0" class="input" placeholder="e.g. 12" />
      <label class="label">Publish date (optional)</label>
      <input v-model="articleForm.publish_date" type="text" class="input" placeholder="e.g. 2024" />
      <label class="label">Description (optional)</label>
      <textarea v-model="articleForm.description" class="input textarea" rows="2" placeholder="Brief note or summary" />
      <p v-if="articleError" class="error">{{ articleError }}</p>
      <button type="submit" class="btn" :disabled="articleSubmitting">
        {{ articleSubmitting ? 'Adding…' : 'Add article' }}
      </button>
    </form>
    <form v-if="showPoemForm" class="form article-form" @submit.prevent="submitPoem">
      <label class="label">Title <span class="required">*</span></label>
      <input v-model="poemForm.title" type="text" class="input" placeholder="Poem title" required />
      <label class="label">Author(s) (comma-separated)</label>
      <input v-model="poemForm.authors" type="text" class="input" placeholder="e.g. Dickinson, E." />
      <label class="label">Initial status</label>
      <select v-model="poemForm.status" class="input">
        <option value="backlog">Backlog</option>
        <option value="in_progress">In progress</option>
        <option value="finished">Finished</option>
      </select>
      <label class="label">Number of pages (optional)</label>
      <input v-model="poemForm.number_of_pages" type="number" min="0" class="input" placeholder="e.g. 1" />
      <label class="label">Publish date (optional)</label>
      <input v-model="poemForm.publish_date" type="text" class="input" placeholder="e.g. 2024" />
      <label class="label">Description (optional)</label>
      <textarea v-model="poemForm.description" class="input textarea" rows="2" placeholder="Brief note" />
      <p v-if="poemError" class="error">{{ poemError }}</p>
      <button type="submit" class="btn" :disabled="poemSubmitting">
        {{ poemSubmitting ? 'Adding…' : 'Add poem' }}
      </button>
    </form>
      </section>
      <section v-if="history.length" class="history">
        <button type="button" class="section-title section-title--clickable" @click="historyMinimized = !historyMinimized">
          <span>Recent lookups</span>
          <span class="history-count">({{ history.length }})</span>
          <span class="collapse-icon">{{ historyMinimized ? '▶' : '▼' }}</span>
        </button>
        <ul v-show="!historyMinimized" class="history-list">
      <li
        v-for="item in history"
        :key="item.isbn"
        class="history-item"
        @click="lookupFromHistory(item)"
      >
        <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="history-cover" />
        <div class="history-info">
          <span class="history-book-title">{{ item.title }}</span>
          <span v-if="isArticle(item)" class="badge badge-article">Article</span>
          <span v-else-if="isPoem(item)" class="badge badge-poem">Poem</span>
          <span v-if="item.authors?.length" class="history-authors">{{ item.authors.join(', ') }}</span>
          <span v-if="item.last_looked_up" class="history-date">Last searched {{ formatDateTime(item.last_looked_up) }}</span>
        </div>
      </li>
        </ul>
      </section>
      <section v-if="backlog.length" class="backlog">
    <h2 class="section-title">Backlog <span class="hint">(drag to reorder within each group)</span></h2>
    <template v-if="backlogBooks.length">
      <h3 class="subsection-title">Books</h3>
      <ul class="backlog-list">
        <li
          v-for="(item, index) in backlogBooks"
          :key="item.isbn"
          class="backlog-item"
          draggable="true"
          @dragstart="onBacklogDragStart($event, item)"
          @dragover="onBacklogDragOver"
          @drop="onBacklogDrop($event, 'book', index)"
        >
          <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
          <div class="list-info">
            <span class="list-title">{{ item.title }}</span>
            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(', ') }}</span>
            <span v-if="item.backlog_date" class="list-date">Added {{ formatDate(item.backlog_date) }}</span>
          </div>
          <div class="list-actions">
            <button type="button" class="btn-small" @click="startReading(item.isbn)">Start reading</button>
            <button type="button" class="btn-small btn-ghost" @click="openEdit(item)">Edit</button>
            <button type="button" class="btn-small btn-ghost" title="Remove from list (keeps progress)" @click="removeFromList(item.isbn)">Remove</button>
          </div>
        </li>
      </ul>
    </template>
    <template v-if="backlogArticles.length">
      <h3 class="subsection-title">Articles</h3>
      <ul class="backlog-list">
        <li
          v-for="(item, index) in backlogArticles"
          :key="item.isbn"
          class="backlog-item"
          draggable="true"
          @dragstart="onBacklogDragStart($event, item)"
          @dragover="onBacklogDragOver"
          @drop="onBacklogDrop($event, 'article', index)"
        >
          <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
          <div class="list-info">
            <span class="list-title">{{ item.title }}</span>
            <span class="badge badge-article">Article</span>
            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(', ') }}</span>
            <span v-if="item.backlog_date" class="list-date">Added {{ formatDate(item.backlog_date) }}</span>
          </div>
          <div class="list-actions">
            <button type="button" class="btn-small" @click="startReading(item.isbn)">Start reading</button>
            <button type="button" class="btn-small btn-ghost" @click="openEdit(item)">Edit</button>
            <button type="button" class="btn-small btn-ghost" title="Remove from list (keeps progress)" @click="removeFromList(item.isbn)">Remove</button>
          </div>
        </li>
      </ul>
    </template>
    <template v-if="backlogPoems.length">
      <h3 class="subsection-title">Poems</h3>
      <ul class="backlog-list">
        <li
          v-for="(item, index) in backlogPoems"
          :key="item.isbn"
          class="backlog-item"
          draggable="true"
          @dragstart="onBacklogDragStart($event, item)"
          @dragover="onBacklogDragOver"
          @drop="onBacklogDrop($event, 'poem', index)"
        >
          <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
          <div class="list-info">
            <span class="list-title">{{ item.title }}</span>
            <span class="badge badge-poem">Poem</span>
            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(', ') }}</span>
            <span v-if="item.backlog_date" class="list-date">Added {{ formatDate(item.backlog_date) }}</span>
          </div>
          <div class="list-actions">
            <button type="button" class="btn-small" @click="startReading(item.isbn)">Start reading</button>
            <button type="button" class="btn-small btn-ghost" @click="openEdit(item)">Edit</button>
            <button type="button" class="btn-small btn-ghost" title="Remove from list (keeps progress)" @click="removeFromList(item.isbn)">Remove</button>
          </div>
        </li>
      </ul>
    </template>
      </section>
    </aside>
    <!-- Middle: Currently reading -->
    <main class="panel panel-center">
      <section v-if="(stats.items_finished_count ?? stats.books_finished_count) > 0 || stats.pages_this_year > 0" class="stats">
        <h2 class="section-title">Stats</h2>
        <div class="stats-grid">
          <div class="stat"><span class="stat-value">{{ stats.items_finished_count ?? stats.books_finished_count }}</span> items read</div>
          <div class="stat"><span class="stat-value">{{ stats.pages_this_month }}</span> pages this month</div>
          <div class="stat"><span class="stat-value">{{ stats.pages_this_year }}</span> pages this year</div>
        </div>
      </section>
      <section class="calendar-section">
        <h2 class="section-title">Reading days</h2>
        <p class="calendar-desc">Days when you started a book, finished one, or updated the page number</p>
        <div class="calendar">
          <div class="calendar-header">
            <button type="button" class="btn-calendar" aria-label="Previous month" @click="calendarPrevMonth">‹</button>
            <span class="calendar-month">{{ calendarMonthName }}</span>
            <button type="button" class="btn-calendar" aria-label="Next month" @click="calendarNextMonth">›</button>
          </div>
          <div class="calendar-weekdays">
            <span v-for="w in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="w" class="calendar-wday">{{ w }}</span>
          </div>
          <div class="calendar-grid">
            <template v-for="(cell, i) in calendarDays" :key="i">
              <div v-if="cell.empty" class="calendar-cell calendar-cell--empty" />
              <div v-else :class="['calendar-cell', cell.active && 'calendar-cell--active']" :title="cell.active ? 'Logged reading' : ''">
                {{ cell.day }}
              </div>
            </template>
          </div>
        </div>
      </section>
      <section v-if="inProgress.length" class="in-progress">
        <h2 class="section-title">Currently reading</h2>
    <template v-if="inProgressBooks.length">
      <h3 class="subsection-title">Books</h3>
      <ul class="progress-list">
        <li v-for="item in inProgressBooks" :key="item.isbn" class="progress-item">
          <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
          <div class="list-info">
            <span class="list-title">{{ item.title }}</span>
            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(', ') }}</span>
            <span v-if="item.started_date" class="list-date">Started {{ formatDate(item.started_date) }}</span>
            <div class="progress-bar-wrap">
              <input type="number" min="0" :max="item.number_of_pages || 9999" :value="item.current_page ?? 0" class="page-input" @change="updateProgress(item.isbn, $event.target.value)" />
              <span class="page-of">/ {{ item.number_of_pages ?? '?' }} pages</span>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progressPercent(item) + '%' }"></div>
              </div>
            </div>
          </div>
          <div class="list-actions">
            <button type="button" class="btn-small" @click="openFinishModal(item.isbn)">Mark finished</button>
            <button type="button" class="btn-small btn-ghost" @click="openEdit(item)">Edit</button>
            <button type="button" class="btn-small btn-ghost" title="Remove from list (keeps pages read)" @click="removeFromList(item.isbn)">Remove</button>
          </div>
        </li>
      </ul>
    </template>
    <template v-if="inProgressArticles.length">
      <h3 class="subsection-title">Articles</h3>
      <ul class="progress-list">
        <li v-for="item in inProgressArticles" :key="item.isbn" class="progress-item">
          <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
          <div class="list-info">
            <span class="list-title">{{ item.title }}</span>
            <span class="badge badge-article">Article</span>
            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(', ') }}</span>
            <span v-if="item.started_date" class="list-date">Started {{ formatDate(item.started_date) }}</span>
            <div class="progress-bar-wrap">
              <input type="number" min="0" :max="item.number_of_pages || 9999" :value="item.current_page ?? 0" class="page-input" @change="updateProgress(item.isbn, $event.target.value)" />
              <span class="page-of">/ {{ item.number_of_pages ?? '?' }} pages</span>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progressPercent(item) + '%' }"></div>
              </div>
            </div>
          </div>
          <div class="list-actions">
            <button type="button" class="btn-small" @click="openFinishModal(item.isbn)">Mark finished</button>
            <button type="button" class="btn-small btn-ghost" @click="openEdit(item)">Edit</button>
            <button type="button" class="btn-small btn-ghost" title="Remove from list (keeps pages read)" @click="removeFromList(item.isbn)">Remove</button>
          </div>
        </li>
      </ul>
    </template>
    <template v-if="inProgressPoems.length">
      <h3 class="subsection-title">Poems</h3>
      <ul class="progress-list">
        <li v-for="item in inProgressPoems" :key="item.isbn" class="progress-item">
          <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
          <div class="list-info">
            <span class="list-title">{{ item.title }}</span>
            <span class="badge badge-poem">Poem</span>
            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(', ') }}</span>
            <span v-if="item.started_date" class="list-date">Started {{ formatDate(item.started_date) }}</span>
            <div class="progress-bar-wrap">
              <input type="number" min="0" :max="item.number_of_pages || 9999" :value="item.current_page ?? 0" class="page-input" @change="updateProgress(item.isbn, $event.target.value)" />
              <span class="page-of">/ {{ item.number_of_pages ?? '?' }} pages</span>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progressPercent(item) + '%' }"></div>
              </div>
            </div>
          </div>
          <div class="list-actions">
            <button type="button" class="btn-small" @click="openFinishModal(item.isbn)">Mark finished</button>
            <button type="button" class="btn-small btn-ghost" @click="openEdit(item)">Edit</button>
            <button type="button" class="btn-small btn-ghost" title="Remove from list (keeps pages read)" @click="removeFromList(item.isbn)">Remove</button>
          </div>
        </li>
      </ul>
    </template>
      </section>
    </main>
    <!-- Right: Read (finished) -->
    <aside class="panel panel-right">
      <section v-if="finished.length" class="finished">
        <h2 class="section-title">Read</h2>
    <template v-if="finishedBooks.length">
      <h3 class="subsection-title">Books</h3>
      <ul class="finished-list">
        <li v-for="item in finishedBooks" :key="item.isbn" class="finished-item">
          <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
          <div class="list-info">
            <span class="list-title">{{ item.title }}</span>
            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(', ') }}</span>
            <span v-if="item.finished_date" class="finished-date">Finished {{ formatDate(item.finished_date) }}</span>
          </div>
          <button type="button" class="btn-small btn-ghost" @click="openEdit(item)">Edit</button>
        </li>
      </ul>
    </template>
    <template v-if="finishedArticles.length">
      <h3 class="subsection-title">Articles</h3>
      <ul class="finished-list">
        <li v-for="item in finishedArticles" :key="item.isbn" class="finished-item">
          <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
          <div class="list-info">
            <span class="list-title">{{ item.title }}</span>
            <span class="badge badge-article">Article</span>
            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(', ') }}</span>
            <span v-if="item.finished_date" class="finished-date">Finished {{ formatDate(item.finished_date) }}</span>
          </div>
          <button type="button" class="btn-small btn-ghost" @click="openEdit(item)">Edit</button>
        </li>
      </ul>
    </template>
    <template v-if="finishedPoems.length">
      <h3 class="subsection-title">Poems</h3>
      <ul class="finished-list">
        <li v-for="item in finishedPoems" :key="item.isbn" class="finished-item">
          <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
          <div class="list-info">
            <span class="list-title">{{ item.title }}</span>
            <span class="badge badge-poem">Poem</span>
            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(', ') }}</span>
            <span v-if="item.finished_date" class="finished-date">Finished {{ formatDate(item.finished_date) }}</span>
          </div>
          <button type="button" class="btn-small btn-ghost" @click="openEdit(item)">Edit</button>
        </li>
      </ul>
    </template>
      </section>
    </aside>
  </div>

  <!-- Finish date modal -->
  <div v-if="showFinishModal" class="modal-overlay" @click.self="showFinishModal = false">
    <div class="modal">
      <h3 class="modal-title">Mark as finished</h3>
      <label class="label">Finished on</label>
      <input v-model="finishDate" type="date" class="input" />
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" @click="showFinishModal = false">Cancel</button>
        <button type="button" class="btn" @click="confirmMarkFinished">Save</button>
      </div>
    </div>
  </div>

  <!-- Edit item modal -->
  <div v-if="editBookForEdit" class="modal-overlay" @click.self="editBookForEdit = null">
    <div class="modal modal-wide">
      <h3 class="modal-title">Edit {{ editBookForEdit?.entry_type === 'article' ? 'article' : editBookForEdit?.entry_type === 'poem' ? 'poem' : 'book' }}</h3>
      <form @submit.prevent="saveEdit" class="edit-form">
        <label class="label">Title</label>
        <input v-model="editBookForEdit.title" type="text" class="input" />
        <label class="label">Authors (comma-separated)</label>
        <input
          :value="Array.isArray(editBookForEdit.authors) ? editBookForEdit.authors.join(', ') : ''"
          type="text"
          class="input"
          @input="editBookForEdit.authors = $event.target.value.split(',').map((s) => s.trim()).filter(Boolean)"
        />
        <label class="label">Publishers (comma-separated)</label>
        <input
          :value="Array.isArray(editBookForEdit.publishers) ? editBookForEdit.publishers.join(', ') : ''"
          type="text"
          class="input"
          @input="editBookForEdit.publishers = $event.target.value.split(',').map((s) => s.trim()).filter(Boolean)"
        />
        <label class="label">Publish date</label>
        <input v-model="editBookForEdit.publish_date" type="text" class="input" placeholder="e.g. 2020" />
        <label class="label">Number of pages</label>
        <input v-model.number="editBookForEdit.number_of_pages" type="number" min="0" class="input" />
        <template v-if="editBookForEdit.status === 'backlog' || editBookForEdit.backlog_date">
          <label class="label">Added to backlog (date)</label>
          <input v-model="editBookForEdit.backlog_date" type="date" class="input" />
        </template>
        <template v-if="editBookForEdit.status === 'in_progress' || editBookForEdit.status === 'finished' || editBookForEdit.started_date">
          <label class="label">Started (date)</label>
          <input v-model="editBookForEdit.started_date" type="date" class="input" />
        </template>
        <label class="label">Description</label>
        <textarea v-model="editBookForEdit.description" class="input textarea" rows="4" />
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="editBookForEdit = null">Cancel</button>
          <button type="submit" class="btn">Save</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.header { margin-bottom: 1.5rem; }
.title { font-family: var(--font-serif); font-size: 2rem; font-weight: 600; margin: 0 0 0.25rem 0; color: var(--accent); }
.tagline { margin: 0; color: var(--muted); font-size: 0.95rem; }

.app-main { display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 1.5rem; align-items: start; }
@media (max-width: 1024px) { .app-main { grid-template-columns: 1fr 1fr; } }
@media (max-width: 768px) { .app-main { grid-template-columns: 1fr; } }
.panel { min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
.panel-left { order: 1; }
.panel-center { order: 2; }
.panel-right { order: 3; }
@media (max-width: 1024px) { .panel-left { order: 1; } .panel-center { order: 2; } .panel-right { order: 3; grid-column: 1 / -1; } }
@media (max-width: 768px) { .panel-center { order: 2; } .panel-right { order: 3; } }

.section-title--clickable { width: 100%; display: flex; align-items: center; gap: 0.5rem; padding: 0 0 0.5rem 0; margin: 0 0 0.5rem 0; border: none; background: none; color: var(--muted); font-family: var(--font-serif); font-size: 1.1rem; font-weight: 600; cursor: pointer; text-align: left; }
.section-title--clickable:hover { color: var(--accent); }
.history-count { font-weight: 400; opacity: 0.9; }
.collapse-icon { margin-left: auto; font-size: 0.75rem; }

.stats { margin-bottom: 1.5rem; }
.section-title { font-family: var(--font-serif); font-size: 1.1rem; font-weight: 600; margin: 0 0 0.75rem 0; color: var(--muted); }
.hint { font-weight: 400; font-size: 0.85rem; opacity: 0.8; }
.stats-grid { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.stat { font-size: 0.95rem; color: var(--muted); }
.stat-value { color: var(--accent); font-weight: 600; margin-right: 0.25rem; }

.add-shortform { margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-start; }
.add-shortform .form { margin-top: 0; margin-right: 1.5rem; }
.article-form { display: flex; flex-direction: column; gap: 0.75rem; max-width: 28rem; }
.article-form .input { flex: none; }
.article-form select { cursor: pointer; }
.required { color: var(--error); }

.badge { display: inline-block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; padding: 0.2rem 0.5rem; border-radius: 4px; margin-left: 0.5rem; vertical-align: middle; }
.badge-article { background: var(--accent); color: var(--bg); }
.badge-poem { background: var(--poem-accent, #7c5cbf); color: var(--bg); }

.subsection-title { font-size: 0.95rem; font-weight: 600; color: var(--muted); margin: 1rem 0 0.5rem 0; }
.subsection-title:first-of-type { margin-top: 0.5rem; }

.calendar-section { margin-bottom: 2rem; }
.calendar-desc { font-size: 0.875rem; color: var(--muted); margin: 0 0 0.75rem 0; }
.calendar { max-width: 20rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
.calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
.calendar-month { font-weight: 600; font-size: 1rem; color: var(--accent); }
.btn-calendar { width: 2rem; height: 2rem; padding: 0; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 6px; cursor: pointer; font-size: 1.25rem; line-height: 1; display: flex; align-items: center; justify-content: center; }
.btn-calendar:hover { border-color: var(--accent); color: var(--accent); }
.calendar-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 4px; text-align: center; }
.calendar-wday { font-size: 0.7rem; color: var(--muted); font-weight: 600; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.calendar-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; border-radius: 6px; }
.calendar-cell--empty { visibility: hidden; }
.calendar-cell--active { background: var(--accent); color: var(--bg); font-weight: 600; }

.form { margin-bottom: 1.5rem; }
.label { display: block; font-size: 0.875rem; color: var(--muted); margin-bottom: 0.5rem; }
.input-row { display: flex; gap: 0.75rem; }
.input { flex: 1; padding: 0.75rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 1rem; font-family: inherit; }
.input:focus { outline: none; border-color: var(--accent); }
.input::placeholder { color: var(--muted); }
.textarea { resize: vertical; min-height: 80px; }

.btn { padding: 0.75rem 1.25rem; background: var(--accent); color: var(--bg); border: none; border-radius: 8px; font-weight: 600; font-size: 0.95rem; cursor: pointer; white-space: nowrap; }
.btn:hover:not(:disabled) { background: var(--accent-dim); }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
.btn-secondary:hover { border-color: var(--accent); }
.btn-small { padding: 0.4rem 0.75rem; font-size: 0.85rem; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; }
.btn-small:hover { border-color: var(--accent); }
.btn-ghost { border-color: transparent; }
.btn-ghost:hover { border-color: var(--border); }

.error { color: var(--error); margin: 0 0 1rem 0; padding: 0.75rem 1rem; background: rgba(199, 92, 92, 0.1); border-radius: 8px; }

.book { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; }
.book-layout { display: flex; gap: 1.5rem; margin-bottom: 1rem; }
.cover-wrap { flex-shrink: 0; }
.cover { width: 120px; height: auto; border-radius: 6px; display: block; }
.details { min-width: 0; }
.book-title { font-family: var(--font-serif); font-size: 1.5rem; font-weight: 600; margin: 0 0 0.75rem 0; line-height: 1.3; }
.meta { margin: 0 0 0.5rem 0; font-size: 0.9rem; }
.meta-label { color: var(--muted); margin-right: 0.35rem; }
.subjects { color: var(--text); }
.description { margin: 0; padding-top: 1rem; border-top: 1px solid var(--border); font-family: var(--font-serif); font-size: 1rem; line-height: 1.6; color: var(--muted); }
.book-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }

.history { margin-bottom: 2rem; }
.history-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.history-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; }
.history-item:hover { border-color: var(--accent); }
.history-cover { width: 40px; height: 56px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.history-info { min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.history-book-title { font-weight: 500; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.history-authors { font-size: 0.8rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.backlog { margin-bottom: 2rem; }
.backlog-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.backlog-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; cursor: grab; }
.backlog-item:active { cursor: grabbing; }
.list-cover { width: 40px; height: 56px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.list-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
.list-title { font-weight: 500; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.list-authors { font-size: 0.8rem; color: var(--muted); }
.list-date { font-size: 0.8rem; color: var(--muted); display: block; margin-top: 0.15rem; }
.list-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
.history-date { font-size: 0.75rem; color: var(--muted); margin-top: 0.1rem; }

.in-progress { margin-bottom: 2rem; }
.progress-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.progress-item { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
.progress-bar-wrap { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
.page-input { width: 4rem; padding: 0.35rem 0.5rem; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 0.9rem; }
.page-of { font-size: 0.85rem; color: var(--muted); }
.progress-bar { flex: 1; min-width: 80px; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width 0.2s; }

.finished { margin-bottom: 2rem; }
.finished-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.finished-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
.finished-date { font-size: 0.8rem; color: var(--muted); }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
.modal { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; max-width: 24rem; width: 100%; }
.modal-wide { max-width: 28rem; }
.modal-title { font-family: var(--font-serif); font-size: 1.25rem; margin: 0 0 1rem 0; color: var(--accent); }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem; }
.edit-form { display: flex; flex-direction: column; gap: 0.75rem; }
.edit-form .input { flex: none; }
</style>
