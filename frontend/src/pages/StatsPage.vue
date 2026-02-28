<script setup>
import { useBookLog } from "../composables/useBookLog";

const { stats } = useBookLog();
</script>

<template>
    <div class="page-content">
        <section class="stats">
            <h2 class="section-title">Stats</h2>
            <div class="stats-grid">
                <div class="stat">
                    <span class="stat-value">{{ stats.books_finished_count ?? 0 }}</span>
                    books read (finished)
                </div>
                <div class="stat">
                    <span class="stat-value">{{ stats.articles_finished_count ?? 0 }}</span>
                    articles read (finished)
                </div>
                <div class="stat">
                    <span class="stat-value">{{ stats.poems_finished_count ?? 0 }}</span>
                    poems read (finished)
                </div>
                <div class="stat">
                    <span class="stat-value">{{ stats.pages_from_finished_this_month ?? stats.pages_this_month }}</span>
                    pages from items finished this month
                </div>
                <div class="stat">
                    <span class="stat-value">{{ stats.pages_from_finished_this_year ?? stats.pages_this_year }}</span>
                    pages from items finished this year
                </div>
                <div class="stat">
                    <span class="stat-value">{{ stats.pages_recorded_this_month ?? 0 }}</span>
                    pages recorded this month (progress)
                </div>
                <div class="stat">
                    <span class="stat-value">{{ stats.pages_recorded_this_year ?? 0 }}</span>
                    pages recorded this year (progress)
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped>
.page-content {
    max-width: 500px;
}
</style>
