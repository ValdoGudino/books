<script setup>
import { useBookLog } from "../composables/useBookLog";

const {
    backlogBooks,
    backlogArticles,
    backlogPoems,
    formatDate,
    startReading,
    openEdit,
    removeFromList,
    onBacklogDragStart,
    onBacklogDragOver,
    onBacklogDrop,
    moveBacklogItem,
    openViewModal,
} = useBookLog();
</script>

<template>
    <div class="page-content">
        <section v-if="backlogBooks.length || backlogArticles.length || backlogPoems.length" class="backlog">
            <h2 class="section-title">
                Backlog
                <span class="hint">(drag or use ↑↓ to reorder within each group)</span>
            </h2>
            <template v-if="backlogBooks.length">
                <h3 class="subsection-title">Books</h3>
                <ul class="backlog-list">
                    <li
                        v-for="(item, index) in backlogBooks"
                        :key="item.isbn"
                        class="backlog-item card-clickable"
                        draggable="true"
                        @dragstart="onBacklogDragStart($event, item)"
                        @dragover="onBacklogDragOver"
                        @drop="onBacklogDrop($event, 'book', index)"
                        @click="openViewModal(item)"
                    >
                        <span class="backlog-pos">{{ index + 1 }}</span>
                        <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
                        <div class="list-info">
                            <span class="list-title">{{ item.title }}</span>
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
                            <span v-if="item.backlog_date" class="list-date">Added {{ formatDate(item.backlog_date) }}</span>
                        </div>
                        <div class="reorder-btns">
                            <button type="button" class="btn-reorder" :disabled="index === 0" title="Move up" @click.stop="moveBacklogItem(item.isbn, 'book', 'up')">↑</button>
                            <button type="button" class="btn-reorder" :disabled="index === backlogBooks.length - 1" title="Move down" @click.stop="moveBacklogItem(item.isbn, 'book', 'down')">↓</button>
                        </div>
                        <div class="list-actions">
                            <button type="button" class="btn-small" @click.stop="startReading(item.isbn)">Start reading</button>
                            <button type="button" class="btn-small btn-ghost" @click.stop="openEdit(item)">Edit</button>
                            <button type="button" class="btn-small btn-ghost" title="Remove from list (keeps progress)" @click.stop="removeFromList(item.isbn)">Remove</button>
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
                        class="backlog-item card-clickable"
                        draggable="true"
                        @dragstart="onBacklogDragStart($event, item)"
                        @dragover="onBacklogDragOver"
                        @drop="onBacklogDrop($event, 'article', index)"
                        @click="openViewModal(item)"
                    >
                        <span class="backlog-pos">{{ index + 1 }}</span>
                        <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
                        <div class="list-info">
                            <span class="list-title">{{ item.title }}</span>
                            <span class="badge badge-article">Article</span>
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
                            <span v-if="item.backlog_date" class="list-date">Added {{ formatDate(item.backlog_date) }}</span>
                        </div>
                        <div class="reorder-btns">
                            <button type="button" class="btn-reorder" :disabled="index === 0" title="Move up" @click.stop="moveBacklogItem(item.isbn, 'article', 'up')">↑</button>
                            <button type="button" class="btn-reorder" :disabled="index === backlogArticles.length - 1" title="Move down" @click.stop="moveBacklogItem(item.isbn, 'article', 'down')">↓</button>
                        </div>
                        <div class="list-actions">
                            <button type="button" class="btn-small" @click.stop="startReading(item.isbn)">Start reading</button>
                            <button type="button" class="btn-small btn-ghost" @click.stop="openEdit(item)">Edit</button>
                            <button type="button" class="btn-small btn-ghost" title="Remove from list (keeps progress)" @click.stop="removeFromList(item.isbn)">Remove</button>
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
                        class="backlog-item card-clickable"
                        draggable="true"
                        @dragstart="onBacklogDragStart($event, item)"
                        @dragover="onBacklogDragOver"
                        @drop="onBacklogDrop($event, 'poem', index)"
                        @click="openViewModal(item)"
                    >
                        <span class="backlog-pos">{{ index + 1 }}</span>
                        <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
                        <div class="list-info">
                            <span class="list-title">{{ item.title }}</span>
                            <span class="badge badge-poem">Poem</span>
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
                            <span v-if="item.backlog_date" class="list-date">Added {{ formatDate(item.backlog_date) }}</span>
                        </div>
                        <div class="reorder-btns">
                            <button type="button" class="btn-reorder" :disabled="index === 0" title="Move up" @click.stop="moveBacklogItem(item.isbn, 'poem', 'up')">↑</button>
                            <button type="button" class="btn-reorder" :disabled="index === backlogPoems.length - 1" title="Move down" @click.stop="moveBacklogItem(item.isbn, 'poem', 'down')">↓</button>
                        </div>
                        <div class="list-actions">
                            <button type="button" class="btn-small" @click.stop="startReading(item.isbn)">Start reading</button>
                            <button type="button" class="btn-small btn-ghost" @click.stop="openEdit(item)">Edit</button>
                            <button type="button" class="btn-small btn-ghost" title="Remove from list (keeps progress)" @click.stop="removeFromList(item.isbn)">Remove</button>
                        </div>
                    </li>
                </ul>
            </template>
        </section>
        <p v-else class="muted-para">Backlog is empty. Add books from <router-link to="/lookup">Look up</router-link>.</p>
    </div>
</template>

<style scoped>
.page-content {
    max-width: 900px;
}
.muted-para {
    color: var(--muted);
    margin-top: 1rem;
}
.muted-para a {
    color: var(--accent);
}
.backlog-pos {
    font-size: 0.75rem;
    color: var(--muted);
    min-width: 1.25rem;
    text-align: right;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
}
.reorder-btns {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
}
.btn-reorder {
    padding: 0.15rem 0.35rem;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    border-radius: 4px;
    cursor: pointer;
    line-height: 1;
}
.btn-reorder:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
}
.btn-reorder:disabled {
    opacity: 0.25;
    cursor: not-allowed;
}
</style>
