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
                    <span class="stat-value">{{ stats.items_finished_count ?? stats.books_finished_count }}</span>
                    items read (finished)
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
