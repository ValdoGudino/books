<script setup>
import { useBookLog } from "../composables/useBookLog";

const {
    isbn,
    book,
    loading,
    error,
    history,
    historyMinimized,
    canSubmit,
    showArticleForm,
    articleForm,
    articleSubmitting,
    articleError,
    showPoemForm,
    poemForm,
    poemSubmitting,
    poemError,
    formatDateTime,
    isArticle,
    isPoem,
    lookup,
    refreshMetadata,
    lookupFromHistory,
    addToBacklog,
    startReadingFromLookup,
    markFinishedFromLookup,
    submitArticle,
    submitPoem,
} = useBookLog();
</script>

<template>
    <div class="page-content">
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
                    {{ loading ? "Looking up…" : "Look up" }}
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
                        <span class="meta-label">Authors</span> {{ book.authors.join(", ") }}
                    </p>
                    <p v-if="book.publishers?.length" class="meta">
                        <span class="meta-label">Publishers</span> {{ book.publishers.join(", ") }}
                    </p>
                    <p v-if="book.publish_date" class="meta">
                        <span class="meta-label">Published</span> {{ book.publish_date }}
                    </p>
                    <p v-if="book.number_of_pages" class="meta">
                        <span class="meta-label">Pages</span> {{ book.number_of_pages }}
                    </p>
                    <p v-if="book.subjects?.length" class="meta">
                        <span class="meta-label">Subjects</span> {{ book.subjects.join(", ") }}
                    </p>
                    <p v-if="book.description" class="meta meta-description">
                        <span class="meta-label">Description</span> {{ book.description }}
                    </p>
                    <div class="book-actions">
                        <button type="button" class="btn btn-secondary" @click="addToBacklog">Add to backlog</button>
                        <button type="button" class="btn btn-secondary" @click="startReadingFromLookup">Start reading</button>
                        <button type="button" class="btn btn-secondary" @click="markFinishedFromLookup">Mark as finished</button>
                        <button type="button" class="btn btn-ghost" :disabled="loading" @click="refreshMetadata">Refresh metadata</button>
                    </div>
                </div>
            </div>
        </article>

        <section class="add-shortform">
            <button type="button" class="btn btn-secondary" @click="showArticleForm = !showArticleForm">
                {{ showArticleForm ? "Cancel" : "Add article" }}
            </button>
            <button type="button" class="btn btn-secondary" @click="showPoemForm = !showPoemForm">
                {{ showPoemForm ? "Cancel" : "Add poem" }}
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
                    {{ articleSubmitting ? "Adding…" : "Add article" }}
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
                    {{ poemSubmitting ? "Adding…" : "Add poem" }}
                </button>
            </form>
        </section>

        <section v-if="history.length" class="history">
            <button
                type="button"
                class="section-title section-title--clickable"
                @click="historyMinimized = !historyMinimized"
            >
                <span>Recent lookups</span>
                <span class="history-count">({{ history.length }})</span>
                <span class="collapse-icon">{{ historyMinimized ? "▶" : "▼" }}</span>
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
                        <span v-if="item.authors?.length" class="history-authors">{{ item.authors.join(", ") }}</span>
                        <span v-if="item.last_looked_up" class="history-date">
                            Last searched {{ formatDateTime(item.last_looked_up) }}
                        </span>
                    </div>
                </li>
            </ul>
        </section>
    </div>
</template>

<style scoped>
.page-content {
    max-width: 600px;
}
.meta-description {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}
</style>
