<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useBookLog } from "./composables/useBookLog";
import { useAuth } from "./composables/useAuth";

const {
    book,
    editBookForEdit,
    finishDate,
    showFinishModal,
    confirmMarkFinished,
    saveEdit,
    closeFinishModal,
    closeEditModal,
    viewBookItem,
    closeViewModal,
    clearBook,
    confirmationMessage,
    showCelebration,
    celebrationCover,
    init,
} = useBookLog();

const { user, signOut } = useAuth();
const descExpanded = ref(false);
const lightboxSrc = ref(null);
const lightboxLoading = ref(false);
watch(viewBookItem, () => { descExpanded.value = false; });

function hiResCoverUrl(url) {
    if (!url) return url;
    // Google Books: swap zoom=1 for zoom=0 (largest available)
    if (url.includes("books.google.com") || url.includes("googleapis.com/books")) {
        return url.replace(/zoom=\d/, "zoom=0").replace(/&edge=curl/, "");
    }
    return url;
}

function openLightbox(coverUrl, isbn) {
    const hiRes = hiResCoverUrl(coverUrl);
    lightboxSrc.value = hiRes;
    lightboxLoading.value = true;

    // Also try Open Library large cover if we have an ISBN
    if (isbn && /^\d{10,13}$/.test(isbn)) {
        const olUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
        const img = new Image();
        img.onload = () => {
            // OL returns a 1x1 pixel for missing covers
            if (img.naturalWidth > 10) {
                lightboxSrc.value = olUrl;
            }
            lightboxLoading.value = false;
        };
        img.onerror = () => { lightboxLoading.value = false; };
        img.src = olUrl;
    } else {
        lightboxLoading.value = false;
    }
}

const router = useRouter();
const route = useRoute();
const navRoutes = ["/", "/backlog", "/read", "/stats", "/lookup"];

async function handleSignOut() {
    await signOut();
    router.push("/login");
}

function handleGlobalKeydown(e) {
    if (e.key === "Escape") {
        if (lightboxSrc.value) { lightboxSrc.value = null; return; }
        if (editBookForEdit.value) { closeEditModal(); return; }
        if (viewBookItem.value) { closeViewModal(); return; }
        if (showFinishModal.value) { closeFinishModal(); return; }
        if (book.value) { clearBook(); return; }
        return;
    }

    // Don't steal arrow keys from inputs/textareas
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        // Don't navigate while a modal is open
        if (editBookForEdit.value || viewBookItem.value || showFinishModal.value) return;
        e.preventDefault();
        const current = navRoutes.indexOf(route.path);
        if (current === -1) return;
        const delta = e.key === "ArrowRight" ? 1 : -1;
        router.push(navRoutes[(current + delta + navRoutes.length) % navRoutes.length]);
    }
}

onMounted(() => {
    if (user.value) init();
    document.addEventListener("keydown", handleGlobalKeydown);
});

// Re-init data when user signs in
watch(user, (newUser) => {
    if (newUser) init();
});
onUnmounted(() => document.removeEventListener("keydown", handleGlobalKeydown));
</script>

<template>
    <header v-if="user" class="app-header">
        <div class="app-header-top">
            <div>
                <h1 class="app-title">Book Log</h1>
                <p class="app-tagline">Look up books and track your reading</p>
            </div>
            <div class="header-user">
                <span class="user-name">{{ user.user_metadata?.full_name || user.email }}</span>
                <button type="button" class="btn-small btn-ghost" @click="handleSignOut">Sign out</button>
            </div>
        </div>
        <nav class="app-nav">
            <router-link to="/" class="nav-link" active-class="router-link-active" exact-active-class="router-link-active">
                Currently reading
            </router-link>
            <router-link to="/backlog" class="nav-link" active-class="router-link-active">
                Backlog
            </router-link>
            <router-link to="/read" class="nav-link" active-class="router-link-active">
                Read
            </router-link>
            <router-link to="/stats" class="nav-link" active-class="router-link-active">
                Stats
            </router-link>
            <router-link to="/lookup" class="nav-link" active-class="router-link-active">
                Look up
            </router-link>
        </nav>
    </header>

    <main>
        <router-view />
    </main>

    <!-- Celebration overlay -->
    <div v-if="showCelebration" class="celebrate-overlay" @click="showCelebration = false; confirmationMessage = null;">
        <div class="confetti-container" aria-hidden="true">
            <div v-for="i in 40" :key="i" class="confetti-piece" :style="{
                left: Math.random() * 100 + '%',
                animationDelay: Math.random() * 0.5 + 's',
                animationDuration: (1.5 + Math.random() * 2) + 's',
                '--confetti-color': ['#c9a227','#e8c547','#4ade80','#60a5fa','#f472b6','#a78bfa','#fb923c'][i % 7],
                '--confetti-rotation': (Math.random() * 720 - 360) + 'deg',
                '--confetti-x': (Math.random() * 200 - 100) + 'px',
            }" />
        </div>
        <div class="celebrate-circle">
            <div class="celebrate-book-wrap">
                <span v-if="!celebrationCover" class="celebrate-tada">🎊</span>
                <div class="celebrate-book" :class="{ 'has-cover': celebrationCover }">
                    <div class="book-cover book-left"></div>
                    <div class="book-cover book-right"></div>
                    <img
                        v-if="celebrationCover"
                        :src="celebrationCover"
                        alt=""
                        class="celebrate-cover-img"
                    />
                </div>
            </div>
            <p class="celebrate-msg">{{ confirmationMessage }}</p>
        </div>
    </div>

    <!-- Confirmation toast (non-celebration) -->
    <div v-if="confirmationMessage && !showCelebration" class="confirmation-toast">
        {{ confirmationMessage }}
    </div>

    <!-- Finish date modal -->
    <div
        v-if="showFinishModal"
        class="modal-overlay"
        @click.self="closeFinishModal"
    >
        <div class="modal">
            <h3 class="modal-title">Mark as finished</h3>
            <label class="label">Finished on</label>
            <input v-model="finishDate" type="date" class="input" />
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" @click="closeFinishModal">
                    Cancel
                </button>
                <button type="button" class="btn" @click="confirmMarkFinished">Save</button>
            </div>
        </div>
    </div>

    <!-- View info modal -->
    <div
        v-if="viewBookItem"
        class="modal-overlay"
        @click.self="closeViewModal"
    >
        <div class="modal modal-wide">
            <h3 class="modal-title">{{ viewBookItem.title }}</h3>
            <div class="view-modal-body">
                <img
                    v-if="viewBookItem.cover_url"
                    :src="viewBookItem.cover_url"
                    :alt="viewBookItem.title"
                    class="view-modal-cover cover-clickable"
                    @click="openLightbox(viewBookItem.cover_url, viewBookItem.isbn)"
                />
                <div class="view-modal-details">
                    <p v-if="viewBookItem.isbn && (!viewBookItem.entry_type || viewBookItem.entry_type === 'book')" class="meta">
                        <span class="meta-label">ISBN</span>{{ viewBookItem.isbn }}
                    </p>
                    <p v-if="viewBookItem.authors?.length" class="meta">
                        <span class="meta-label">Authors</span>{{ viewBookItem.authors.join(", ") }}
                    </p>
                    <p v-if="viewBookItem.publishers?.length" class="meta">
                        <span class="meta-label">Publishers</span>{{ viewBookItem.publishers.join(", ") }}
                    </p>
                    <p v-if="viewBookItem.publish_date" class="meta">
                        <span class="meta-label">Published</span>{{ viewBookItem.publish_date }}
                    </p>
                    <p v-if="viewBookItem.number_of_pages" class="meta">
                        <span class="meta-label">Pages</span>{{ viewBookItem.number_of_pages }}
                    </p>
                    <p v-if="viewBookItem.subjects?.length" class="meta">
                        <span class="meta-label">Subjects</span>{{ viewBookItem.subjects.join(", ") }}
                    </p>
                    <div v-if="viewBookItem.description" class="meta view-modal-description">
                        <span class="meta-label">Description</span>
                        <span :class="{ 'description-collapsed': !descExpanded }">{{ viewBookItem.description }}</span>
                        <button v-if="viewBookItem.description.length > 150" type="button" class="desc-toggle" @click="descExpanded = !descExpanded">
                            {{ descExpanded ? 'Show less' : 'Show more' }}
                        </button>
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" @click="closeViewModal">Close</button>
            </div>
        </div>
    </div>

    <!-- Edit item modal -->
    <div
        v-if="editBookForEdit"
        class="modal-overlay"
        @click.self="closeEditModal"
    >
        <div class="modal modal-wide">
            <h3 class="modal-title">
                Edit
                {{
                    editBookForEdit?.entry_type === "article"
                        ? "article"
                        : editBookForEdit?.entry_type === "poem"
                          ? "poem"
                          : "book"
                }}
            </h3>
            <form @submit.prevent="saveEdit" class="edit-form">
                <label class="label">Title</label>
                <input v-model="editBookForEdit.title" type="text" class="input" />
                <label class="label">Authors (comma-separated)</label>
                <input
                    :value="
                        Array.isArray(editBookForEdit.authors)
                            ? editBookForEdit.authors.join(', ')
                            : ''
                    "
                    type="text"
                    class="input"
                    @input="
                        editBookForEdit.authors = $event.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                    "
                />
                <label class="label">Publishers (comma-separated)</label>
                <input
                    :value="
                        Array.isArray(editBookForEdit.publishers)
                            ? editBookForEdit.publishers.join(', ')
                            : ''
                    "
                    type="text"
                    class="input"
                    @input="
                        editBookForEdit.publishers = $event.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                    "
                />
                <label class="label">Publish date</label>
                <input
                    v-model="editBookForEdit.publish_date"
                    type="text"
                    class="input"
                    placeholder="e.g. 2020"
                />
                <label class="label">Number of pages</label>
                <input v-model.number="editBookForEdit.number_of_pages" type="number" min="0" class="input" />
                <label class="label">Reading status</label>
                <select v-model="editBookForEdit.status" class="input">
                    <option :value="null">—</option>
                    <option value="backlog">Backlog</option>
                    <option value="in_progress">In progress</option>
                    <option value="finished">Finished</option>
                </select>
                <label class="label">Current page (if in progress)</label>
                <input v-model.number="editBookForEdit.current_page" type="number" min="0" class="input" placeholder="0" />
                <template v-if="editBookForEdit.status === 'backlog' || editBookForEdit.backlog_date">
                    <label class="label">Added to backlog (date)</label>
                    <input v-model="editBookForEdit.backlog_date" type="date" class="input" />
                </template>
                <template v-if="editBookForEdit.status === 'in_progress' || editBookForEdit.status === 'finished' || editBookForEdit.started_date">
                    <label class="label">Started (date)</label>
                    <input v-model="editBookForEdit.started_date" type="date" class="input" />
                </template>
                <template v-if="editBookForEdit.status === 'finished' || editBookForEdit.finished_date">
                    <label class="label">Finished (date)</label>
                    <input v-model="editBookForEdit.finished_date" type="date" class="input" />
                </template>
                <label class="label">Description</label>
                <textarea
                    v-model="editBookForEdit.description"
                    class="input textarea"
                    rows="4"
                />
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" @click="closeEditModal">
                        Cancel
                    </button>
                    <button type="submit" class="btn">Save</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Cover lightbox -->
    <div
        v-if="lightboxSrc"
        class="lightbox-overlay"
        @click="lightboxSrc = null"
    >
        <img :src="lightboxSrc" alt="" class="lightbox-img" @click.stop />
    </div>
</template>
