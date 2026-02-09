<script setup>
import { useBookLog } from "../composables/useBookLog";

const {
    finishedBooks,
    finishedArticles,
    finishedPoems,
    formatDate,
    openEdit,
    deleteFromRead,
} = useBookLog();
</script>

<template>
    <div class="page-content">
        <section v-if="finishedBooks.length || finishedArticles.length || finishedPoems.length" class="finished">
            <h2 class="section-title">Read</h2>
            <template v-if="finishedBooks.length">
                <h3 class="subsection-title">Books</h3>
                <ul class="finished-list">
                    <li v-for="item in finishedBooks" :key="item.isbn" class="finished-item">
                        <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
                        <div class="list-info">
                            <span class="list-title">{{ item.title }}</span>
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
                            <span v-if="item.finished_date" class="finished-date">Finished {{ formatDate(item.finished_date) }}</span>
                        </div>
                        <button type="button" class="btn-small btn-ghost" @click="openEdit(item)">Edit</button>
                        <button type="button" class="btn-small btn-ghost btn-danger" title="Remove from Read and clear history" @click="deleteFromRead(item.isbn)">Delete</button>
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
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
                            <span v-if="item.finished_date" class="finished-date">Finished {{ formatDate(item.finished_date) }}</span>
                        </div>
                        <button type="button" class="btn-small btn-ghost" @click="openEdit(item)">Edit</button>
                        <button type="button" class="btn-small btn-ghost btn-danger" title="Remove from Read and clear history" @click="deleteFromRead(item.isbn)">Delete</button>
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
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
                            <span v-if="item.finished_date" class="finished-date">Finished {{ formatDate(item.finished_date) }}</span>
                        </div>
                        <button type="button" class="btn-small btn-ghost" @click="openEdit(item)">Edit</button>
                        <button type="button" class="btn-small btn-ghost btn-danger" title="Remove from Read and clear history" @click="deleteFromRead(item.isbn)">Delete</button>
                    </li>
                </ul>
            </template>
        </section>
        <p v-else class="muted-para">No finished items yet. Mark books as finished from <router-link to="/">Currently reading</router-link>.</p>
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
.btn-danger {
    color: var(--error);
}
.btn-danger:hover {
    border-color: var(--error);
}
</style>
