<script setup>
import { ref, computed, onMounted } from 'vue'

const isbn = ref('')
const book = ref(null)
const loading = ref(false)
const error = ref(null)
const history = ref([])

const canSubmit = computed(() => {
  const cleaned = (isbn.value || '').replace(/[\s-]/g, '')
  return cleaned.length >= 10 && /^\d+$/.test(cleaned)
})

async function loadHistory() {
  try {
    const res = await fetch('/api/books/history')
    if (res.ok) {
      history.value = await res.json()
    }
  } catch {
    history.value = []
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

onMounted(loadHistory)
</script>

<template>
  <header class="header">
    <h1 class="title">Book Log</h1>
    <p class="tagline">Look up a book by ISBN</p>
  </header>

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

  <section v-if="history.length" class="history">
    <h2 class="history-title">Recent lookups</h2>
    <ul class="history-list">
      <li
        v-for="item in history"
        :key="item.isbn"
        class="history-item"
        @click="lookupFromHistory(item)"
      >
        <img
          v-if="item.cover_url"
          :src="item.cover_url"
          :alt="item.title"
          class="history-cover"
        />
        <div class="history-info">
          <span class="history-book-title">{{ item.title }}</span>
          <span v-if="item.authors?.length" class="history-authors">{{ item.authors.join(', ') }}</span>
        </div>
      </li>
    </ul>
  </section>

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
        <p v-if="book.publishers?.length" class="meta">
          <span class="meta-label">Publisher(s)</span>
          {{ book.publishers.join(', ') }}
        </p>
        <p v-if="book.number_of_pages" class="meta">
          <span class="meta-label">Pages</span>
          {{ book.number_of_pages }}
        </p>
        <p class="meta">
          <span class="meta-label">ISBN</span>
          {{ book.isbn }}
        </p>
        <div v-if="book.subjects?.length" class="meta">
          <span class="meta-label">Subjects</span>
          <span class="subjects">{{ book.subjects.join(', ') }}</span>
        </div>
      </div>
    </div>
    <p v-if="book.description" class="description">{{ book.description }}</p>
  </article>
</template>

<style scoped>
.header {
  margin-bottom: 2rem;
}

.title {
  font-family: var(--font-serif);
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
  color: var(--accent);
}

.tagline {
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
}

.form {
  margin-bottom: 1.5rem;
}

.label {
  display: block;
  font-size: 0.875rem;
  color: var(--muted);
  margin-bottom: 0.5rem;
}

.input-row {
  display: flex;
  gap: 0.75rem;
}

.input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 1rem;
  font-family: inherit;
}

.input:focus {
  outline: none;
  border-color: var(--accent);
}

.input::placeholder {
  color: var(--muted);
}

.btn {
  padding: 0.75rem 1.25rem;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  white-space: nowrap;
}

.btn:hover:not(:disabled) {
  background: var(--accent-dim);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: var(--error);
  margin: 0 0 1rem 0;
  padding: 0.75rem 1rem;
  background: rgba(199, 92, 92, 0.1);
  border-radius: 8px;
}

.history {
  margin-bottom: 2rem;
}

.history-title {
  font-family: var(--font-serif);
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  color: var(--muted);
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
}

.history-item:hover {
  border-color: var(--accent);
}

.history-cover {
  width: 40px;
  height: 56px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.history-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.history-book-title {
  font-weight: 500;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-authors {
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
}

.book-layout {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.cover-wrap {
  flex-shrink: 0;
}

.cover {
  width: 120px;
  height: auto;
  border-radius: 6px;
  display: block;
}

.details {
  min-width: 0;
}

.book-title {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  line-height: 1.3;
}

.meta {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
}

.meta-label {
  color: var(--muted);
  margin-right: 0.35rem;
}

.subjects {
  color: var(--text);
}

.description {
  margin: 0;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--muted);
}
</style>
