<script setup>
import { computed, onMounted } from "vue";
import { useBookLog } from "../composables/useBookLog";

const {
    inProgressBooks,
    inProgressArticles,
    inProgressPoems,
    activityDates,
    calendarMonth,
    calendarYear,
    calendarMonthName,
    calendarDays,
    monthSummary,
    formatDate,
    progressPercent,
    updateProgress,
    openFinishModal,
    openEdit,
    removeFromList,
    calendarPrevMonth,
    calendarNextMonth,
    toggleCalendarDay,
    loadActivityDates,
    loadMonthSummary,
    isArticle,
    isPoem,
    openViewModal,
} = useBookLog();

const isCurrentMonth = computed(() => {
    const now = new Date();
    return calendarYear.value === now.getFullYear() && calendarMonth.value === now.getMonth();
});

onMounted(() => {
    loadActivityDates();
    loadMonthSummary(calendarYear.value, calendarMonth.value);
});
</script>

<template>
    <div class="page-content home-layout">
        <aside class="home-calendar">
            <section class="calendar-section">
                <h2 class="section-title">Reading days</h2>
            <p class="calendar-desc">
                Days when you started a book, finished one, or updated the page number. Click a day to toggle it on or off (override has final say).
            </p>
            <div class="calendar">
                <div class="calendar-header">
                    <button
                        type="button"
                        class="btn-calendar"
                        aria-label="Previous month"
                        @click="calendarPrevMonth"
                    >
                        ‹
                    </button>
                    <span class="calendar-month">{{ calendarMonthName }}</span>
                    <button
                        type="button"
                        class="btn-calendar"
                        aria-label="Next month"
                        @click="calendarNextMonth"
                    >
                        ›
                    </button>
                </div>
                <div class="calendar-weekdays">
                    <span
                        v-for="w in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
                        :key="w"
                        class="calendar-wday"
                    >{{ w }}</span>
                </div>
                <div class="calendar-grid">
                    <template v-for="(cell, i) in calendarDays" :key="cell.empty ? `empty-${i}` : `${cell.dateStr}-${cell.active}`">
                        <div
                            v-if="cell.empty"
                            class="calendar-cell calendar-cell--empty"
                        />
                        <button
                            v-else
                            type="button"
                            :class="['calendar-cell', cell.active && 'calendar-cell--active']"
                            :title="cell.active ? 'Logged reading (click to turn off)' : 'Click to mark as reading day'"
                            @click="toggleCalendarDay(cell.dateStr)"
                        >
                            {{ cell.day }}
                        </button>
                    </template>
                </div>
            </div>
            <section class="month-summary">
                <h3 class="subsection-title">
                    {{ isCurrentMonth ? "This month (so far)" : calendarMonthName }}
                </h3>
                <p class="month-summary-stats">
                    <strong>{{ monthSummary.pages_read }}</strong> pages from items finished
                    · <strong>{{ monthSummary.pages_recorded }}</strong> pages recorded (progress)
                    · <strong>{{ monthSummary.items_finished.length }}</strong> item{{ monthSummary.items_finished.length === 1 ? "" : "s" }} finished
                </p>
                <ul v-if="monthSummary.items_finished.length" class="month-finished-list">
                    <li v-for="item in monthSummary.items_finished" :key="item.isbn" class="month-finished-item card-clickable" @click="openViewModal(item)">
                        <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="month-finished-cover" />
                        <div class="month-finished-info">
                            <span class="list-title">{{ item.title }}</span>
                            <span v-if="isArticle(item)" class="badge badge-article">Article</span>
                            <span v-else-if="isPoem(item)" class="badge badge-poem">Poem</span>
                            <span v-if="item.finished_date" class="list-date">Finished {{ formatDate(item.finished_date) }}</span>
                        </div>
                    </li>
                </ul>
            </section>
        </section>
        </aside>

        <div class="home-reading">
        <section v-if="inProgressBooks.length || inProgressArticles.length || inProgressPoems.length" class="in-progress">
            <h2 class="section-title">Currently reading</h2>
            <template v-if="inProgressBooks.length">
                <h3 class="subsection-title">Books</h3>
                <ul class="progress-list">
                    <li
                        v-for="item in inProgressBooks"
                        :key="item.isbn"
                        class="progress-item card-clickable"
                        @click="openViewModal(item)"
                    >
                        <img
                            v-if="item.cover_url"
                            :src="item.cover_url"
                            :alt="item.title"
                            class="list-cover"
                        />
                        <div class="list-info">
                            <span class="list-title">{{ item.title }}</span>
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
                            <span v-if="item.started_date" class="list-date">Started {{ formatDate(item.started_date) }}</span>
                            <span v-if="item.last_progress_date" class="list-date">Last updated {{ formatDate(item.last_progress_date) }}</span>
                            <div class="progress-bar-wrap" @click.stop>
                                <input
                                    type="text"
                                    inputmode="numeric"
                                    :placeholder="(item.current_page ?? 0) + ' or +20'"
                                    :value="item.current_page ?? 0"
                                    class="page-input page-input-math"
                                    @change="updateProgress(item.isbn, $event.target.value, item.current_page ?? 0)"
                                />
                                <span class="page-of">/ {{ item.number_of_pages ?? "?" }} pages</span>
                                <span class="progress-pct" v-if="item.number_of_pages">({{ progressPercent(item) }}%)</span>
                                <div class="progress-bar">
                                    <div class="progress-fill" :style="{ width: progressPercent(item) + '%' }"></div>
                                </div>
                            </div>
                        </div>
                        <div class="list-actions">
                            <button type="button" class="btn-small" @click.stop="openFinishModal(item.isbn)">Mark finished</button>
                            <button type="button" class="btn-small btn-ghost" @click.stop="openEdit(item)">Edit</button>
                            <button type="button" class="btn-small btn-ghost" title="Remove from list (keeps pages read)" @click.stop="removeFromList(item.isbn)">Remove</button>
                        </div>
                    </li>
                </ul>
            </template>
            <template v-if="inProgressArticles.length">
                <h3 class="subsection-title">Articles</h3>
                <ul class="progress-list">
                    <li
                        v-for="item in inProgressArticles"
                        :key="item.isbn"
                        class="progress-item card-clickable"
                        @click="openViewModal(item)"
                    >
                        <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
                        <div class="list-info">
                            <span class="list-title">{{ item.title }}</span>
                            <span class="badge badge-article">Article</span>
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
                            <span v-if="item.started_date" class="list-date">Started {{ formatDate(item.started_date) }}</span>
                            <span v-if="item.last_progress_date" class="list-date">Last updated {{ formatDate(item.last_progress_date) }}</span>
                            <div class="progress-bar-wrap" @click.stop>
                                <input
                                    type="text"
                                    inputmode="numeric"
                                    :placeholder="(item.current_page ?? 0) + ' or +20'"
                                    :value="item.current_page ?? 0"
                                    class="page-input page-input-math"
                                    @change="updateProgress(item.isbn, $event.target.value, item.current_page ?? 0)"
                                />
                                <span class="page-of">/ {{ item.number_of_pages ?? "?" }} pages</span>
                                <span class="progress-pct" v-if="item.number_of_pages">({{ progressPercent(item) }}%)</span>
                                <div class="progress-bar">
                                    <div class="progress-fill" :style="{ width: progressPercent(item) + '%' }"></div>
                                </div>
                            </div>
                        </div>
                        <div class="list-actions">
                            <button type="button" class="btn-small" @click.stop="openFinishModal(item.isbn)">Mark finished</button>
                            <button type="button" class="btn-small btn-ghost" @click.stop="openEdit(item)">Edit</button>
                            <button type="button" class="btn-small btn-ghost" title="Remove from list (keeps pages read)" @click.stop="removeFromList(item.isbn)">Remove</button>
                        </div>
                    </li>
                </ul>
            </template>
            <template v-if="inProgressPoems.length">
                <h3 class="subsection-title">Poems</h3>
                <ul class="progress-list">
                    <li
                        v-for="item in inProgressPoems"
                        :key="item.isbn"
                        class="progress-item card-clickable"
                        @click="openViewModal(item)"
                    >
                        <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" class="list-cover" />
                        <div class="list-info">
                            <span class="list-title">{{ item.title }}</span>
                            <span class="badge badge-poem">Poem</span>
                            <span v-if="item.authors?.length" class="list-authors">{{ item.authors.join(", ") }}</span>
                            <span v-if="item.started_date" class="list-date">Started {{ formatDate(item.started_date) }}</span>
                            <span v-if="item.last_progress_date" class="list-date">Last updated {{ formatDate(item.last_progress_date) }}</span>
                            <div class="progress-bar-wrap" @click.stop>
                                <input
                                    type="text"
                                    inputmode="numeric"
                                    :placeholder="(item.current_page ?? 0) + ' or +20'"
                                    :value="item.current_page ?? 0"
                                    class="page-input page-input-math"
                                    @change="updateProgress(item.isbn, $event.target.value, item.current_page ?? 0)"
                                />
                                <span class="page-of">/ {{ item.number_of_pages ?? "?" }} pages</span>
                                <span class="progress-pct" v-if="item.number_of_pages">({{ progressPercent(item) }}%)</span>
                                <div class="progress-bar">
                                    <div class="progress-fill" :style="{ width: progressPercent(item) + '%' }"></div>
                                </div>
                            </div>
                        </div>
                        <div class="list-actions">
                            <button type="button" class="btn-small" @click.stop="openFinishModal(item.isbn)">Mark finished</button>
                            <button type="button" class="btn-small btn-ghost" @click.stop="openEdit(item)">Edit</button>
                            <button type="button" class="btn-small btn-ghost" title="Remove from list (keeps pages read)" @click.stop="removeFromList(item.isbn)">Remove</button>
                        </div>
                    </li>
                </ul>
            </template>
        </section>
        <p v-else class="muted-para">Nothing in progress. Add from <router-link to="/lookup">Look up</router-link> or <router-link to="/backlog">Backlog</router-link>.</p>
        </div>
    </div>
</template>

<style scoped>
.page-content {
    max-width: none;
}
.home-layout {
    display: grid;
    grid-template-columns: minmax(240px, 320px) 1fr;
    gap: 2rem;
    align-items: start;
}
.home-calendar {
    position: sticky;
    top: 1rem;
}
.home-reading {
    min-width: 0;
    overflow-y: auto;
    max-height: calc(100vh - 8rem);
}
.month-summary {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
}
.month-summary-stats {
    font-size: 0.95rem;
    color: var(--muted);
    margin: 0 0 0.5rem 0;
}
.month-finished-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}
.month-finished-item {
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: nowrap;
    border-radius: 6px;
    padding: 0.2rem 0.35rem;
}
.month-finished-item .list-title {
    font-weight: 500;
}
.progress-pct {
    font-size: 0.85rem;
    color: var(--muted);
}
.page-input-math {
    width: 5rem;
}
.muted-para {
    color: var(--muted);
    margin-top: 1rem;
}
.muted-para a {
    color: var(--accent);
}
@media (max-width: 768px) {
    .home-layout {
        grid-template-columns: 1fr;
    }
    .home-calendar {
        position: static;
    }
    .home-reading {
        max-height: none;
    }
}
</style>
