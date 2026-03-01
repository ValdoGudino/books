<script setup>
import { ref, onMounted, onUnmounted } from "vue";
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
    moveBacklogItemToPosition,
    openViewModal,
    updateFormat,
} = useBookLog();

const formats = ['physical', 'ebook', 'audio', 'multi'];

const vFocus = { mounted: (el) => { el.focus(); el.select(); } };

// ── position-jump editing ─────────────────────────────────────────────────────
const editingPosIsbn = ref(null);
const editingPosValue = ref(1);
const posEditEscaped = ref(false);

function startPosEdit(isbnVal, currentPos) {
    editingPosIsbn.value = isbnVal;
    editingPosValue.value = currentPos;
    posEditEscaped.value = false;
}

function cancelPosEdit() {
    posEditEscaped.value = true;
    editingPosIsbn.value = null;
}

async function applyPosEdit(isbnVal, sectionType) {
    if (posEditEscaped.value) {
        posEditEscaped.value = false;
        return;
    }
    editingPosIsbn.value = null;
    const pos = editingPosValue.value;
    if (pos == null || !Number.isFinite(pos) || !Number.isInteger(pos)) return;
    await moveBacklogItemToPosition(isbnVal, sectionType, pos);
}

// ── keyboard-selection reordering ────────────────────────────────────────────
const selectedIsbn = ref(null);
const selectedSectionType = ref(null);

function selectItem(isbnVal, sectionType) {
    selectedIsbn.value = isbnVal;
    selectedSectionType.value = sectionType;
}

async function clickReorder(isbnVal, sectionType, direction) {
    selectedIsbn.value = isbnVal;
    selectedSectionType.value = sectionType;
    await moveBacklogItem(isbnVal, sectionType, direction);
}

async function handleKeydown(e) {
    if (!selectedIsbn.value) return;
    if (e.key === "ArrowUp") {
        e.preventDefault();
        await moveBacklogItem(selectedIsbn.value, selectedSectionType.value, "up");
    } else if (e.key === "ArrowDown") {
        e.preventDefault();
        await moveBacklogItem(selectedIsbn.value, selectedSectionType.value, "down");
    } else if (e.key === "Escape") {
        selectedIsbn.value = null;
        selectedSectionType.value = null;
    }
}

onMounted(() => document.addEventListener("keydown", handleKeydown));
onUnmounted(() => document.removeEventListener("keydown", handleKeydown));
</script>

<template>
    <div class="page-content">
        <section v-if="backlogBooks.length || backlogArticles.length || backlogPoems.length" class="backlog">
            <h2 class="section-title">
                Backlog
                <span class="hint">(drag or ↑↓ to reorder; click # for position; click item to select for arrow keys)</span>
            </h2>
            <template v-if="backlogBooks.length">
                <h3 class="subsection-title">Books</h3>
                <ul class="backlog-list">
                    <li
                        v-for="(item, index) in backlogBooks"
                        :key="item.isbn"
                        class="backlog-item card-clickable"
                        :class="{ 'backlog-item-selected': selectedIsbn === item.isbn }"
                        draggable="true"
                        @dragstart="onBacklogDragStart($event, item)"
                        @dragover="onBacklogDragOver"
                        @drop="onBacklogDrop($event, 'book', index)"
                        @click="selectItem(item.isbn, 'book')"
                    >
                        <span class="backlog-pos" :class="{ 'backlog-pos-editing': editingPosIsbn === item.isbn }" @click.stop="startPosEdit(item.isbn, index + 1)">
                            <input
                                v-if="editingPosIsbn === item.isbn"
                                v-focus
                                class="pos-input"
                                type="number"
                                :min="1"
                                :max="backlogBooks.length"
                                v-model.number="editingPosValue"
                                @keydown.enter.stop="applyPosEdit(item.isbn, 'book')"
                                @keydown.escape.stop="cancelPosEdit"
                                @blur="applyPosEdit(item.isbn, 'book')"
                                @click.stop
                            />
                            <template v-else>{{ index + 1 }}</template>
                        </span>
                        <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" @click.stop="openViewModal(item)" />
                        <div class="list-info" @click.stop="openViewModal(item)">
                            <span class="list-title">{{ item.title }}</span>
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
                            <span v-if="item.backlog_date" class="list-date">Added {{ formatDate(item.backlog_date) }}</span>
                            <div class="format-tags" @click.stop>
                                <button v-for="f in formats" :key="f" type="button" :class="['badge-format', `badge-format-${f}`, { active: item.format === f }]" @click="updateFormat(item.isbn, item.format === f ? null : f)">{{ f }}</button>
                            </div>
                        </div>
                        <div class="list-spacer"></div>
                        <div class="reorder-btns">
                            <button type="button" class="btn-reorder" :disabled="index === 0" title="Move up" @click.stop="clickReorder(item.isbn, 'book', 'up')">↑</button>
                            <button type="button" class="btn-reorder" :disabled="index === backlogBooks.length - 1" title="Move down" @click.stop="clickReorder(item.isbn, 'book', 'down')">↓</button>
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
                        :class="{ 'backlog-item-selected': selectedIsbn === item.isbn }"
                        draggable="true"
                        @dragstart="onBacklogDragStart($event, item)"
                        @dragover="onBacklogDragOver"
                        @drop="onBacklogDrop($event, 'article', index)"
                        @click="selectItem(item.isbn, 'article')"
                    >
                        <span class="backlog-pos" :class="{ 'backlog-pos-editing': editingPosIsbn === item.isbn }" @click.stop="startPosEdit(item.isbn, index + 1)">
                            <input
                                v-if="editingPosIsbn === item.isbn"
                                v-focus
                                class="pos-input"
                                type="number"
                                :min="1"
                                :max="backlogArticles.length"
                                v-model.number="editingPosValue"
                                @keydown.enter.stop="applyPosEdit(item.isbn, 'article')"
                                @keydown.escape.stop="cancelPosEdit"
                                @blur="applyPosEdit(item.isbn, 'article')"
                                @click.stop
                            />
                            <template v-else>{{ index + 1 }}</template>
                        </span>
                        <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" @click.stop="openViewModal(item)" />
                        <div class="list-info" @click.stop="openViewModal(item)">
                            <span class="list-title">{{ item.title }}</span>
                            <span class="badge badge-article">Article</span>
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
                            <span v-if="item.backlog_date" class="list-date">Added {{ formatDate(item.backlog_date) }}</span>
                            <div class="format-tags" @click.stop>
                                <button v-for="f in formats" :key="f" type="button" :class="['badge-format', `badge-format-${f}`, { active: item.format === f }]" @click="updateFormat(item.isbn, item.format === f ? null : f)">{{ f }}</button>
                            </div>
                        </div>
                        <div class="list-spacer"></div>
                        <div class="reorder-btns">
                            <button type="button" class="btn-reorder" :disabled="index === 0" title="Move up" @click.stop="clickReorder(item.isbn, 'article', 'up')">↑</button>
                            <button type="button" class="btn-reorder" :disabled="index === backlogArticles.length - 1" title="Move down" @click.stop="clickReorder(item.isbn, 'article', 'down')">↓</button>
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
                        :class="{ 'backlog-item-selected': selectedIsbn === item.isbn }"
                        draggable="true"
                        @dragstart="onBacklogDragStart($event, item)"
                        @dragover="onBacklogDragOver"
                        @drop="onBacklogDrop($event, 'poem', index)"
                        @click="selectItem(item.isbn, 'poem')"
                    >
                        <span class="backlog-pos" :class="{ 'backlog-pos-editing': editingPosIsbn === item.isbn }" @click.stop="startPosEdit(item.isbn, index + 1)">
                            <input
                                v-if="editingPosIsbn === item.isbn"
                                v-focus
                                class="pos-input"
                                type="number"
                                :min="1"
                                :max="backlogPoems.length"
                                v-model.number="editingPosValue"
                                @keydown.enter.stop="applyPosEdit(item.isbn, 'poem')"
                                @keydown.escape.stop="cancelPosEdit"
                                @blur="applyPosEdit(item.isbn, 'poem')"
                                @click.stop
                            />
                            <template v-else>{{ index + 1 }}</template>
                        </span>
                        <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" @click.stop="openViewModal(item)" />
                        <div class="list-info" @click.stop="openViewModal(item)">
                            <span class="list-title">{{ item.title }}</span>
                            <span class="badge badge-poem">Poem</span>
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
                            <span v-if="item.backlog_date" class="list-date">Added {{ formatDate(item.backlog_date) }}</span>
                            <div class="format-tags" @click.stop>
                                <button v-for="f in formats" :key="f" type="button" :class="['badge-format', `badge-format-${f}`, { active: item.format === f }]" @click="updateFormat(item.isbn, item.format === f ? null : f)">{{ f }}</button>
                            </div>
                        </div>
                        <div class="list-spacer"></div>
                        <div class="reorder-btns">
                            <button type="button" class="btn-reorder" :disabled="index === 0" title="Move up" @click.stop="clickReorder(item.isbn, 'poem', 'up')">↑</button>
                            <button type="button" class="btn-reorder" :disabled="index === backlogPoems.length - 1" title="Move down" @click.stop="clickReorder(item.isbn, 'poem', 'down')">↓</button>
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
.backlog-item {
    cursor: pointer;
}
/* Override global flex:1 so the info area only covers its text content.
   The spacer div next to it absorbs the remaining row space. */
.list-info {
    flex: none;
}
.list-spacer {
    flex: 1;
}
.backlog-item-selected {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    border-radius: 6px;
}
.backlog-pos {
    font-size: 0.75rem;
    color: var(--muted);
    min-width: 1.25rem;
    text-align: right;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
}
.backlog-pos:hover:not(.backlog-pos-editing) {
    color: var(--accent);
    text-decoration: underline dotted;
}
.backlog-pos-editing {
    cursor: default;
}
.pos-input {
    width: 2.5rem;
    font-size: 0.75rem;
    padding: 0.1rem 0.2rem;
    border: 1px solid var(--accent);
    border-radius: 3px;
    background: var(--bg);
    color: var(--text);
    text-align: center;
    font-variant-numeric: tabular-nums;
}
.pos-input::-webkit-inner-spin-button,
.pos-input::-webkit-outer-spin-button {
    opacity: 1;
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
