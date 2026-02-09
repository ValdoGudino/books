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
} = useBookLog();
</script>

<template>
    <div class="page-content">
        <section v-if="backlogBooks.length || backlogArticles.length || backlogPoems.length" class="backlog">
            <h2 class="section-title">
                Backlog
                <span class="hint">(drag to reorder within each group)</span>
            </h2>
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
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
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
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
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
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
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
        <p v-else class="muted-para">Backlog is empty. Add books from <router-link to="/lookup">Look up</router-link>.</p>
    </div>
</template>

<style scoped>
.page-content {
    max-width: 700px;
}
.muted-para {
    color: var(--muted);
    margin-top: 1rem;
}
.muted-para a {
    color: var(--accent);
}
</style>
