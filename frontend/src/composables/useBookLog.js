import { ref, computed } from "vue";
import { supabase } from "../lib/supabase";

// Shared state (module-level so all pages see the same data)
const isbn = ref("");
const book = ref(null);
const loading = ref(false);
const error = ref(null);
const history = ref([]);
const backlog = ref([]);
const inProgress = ref([]);
const finished = ref([]);
const stats = ref({
    pages_this_month: 0,
    pages_this_year: 0,
    books_finished_count: 0,
    items_finished_count: 0,
});
const editBook = ref(null);
const editBookForEdit = ref(null);
const finishDate = ref("");
const showFinishModal = ref(false);
const draggedIsbn = ref(null);
const draggedSection = ref(null);
const showArticleForm = ref(false);
const articleForm = ref({
    title: "",
    authors: "",
    status: "backlog",
    number_of_pages: "",
    publish_date: "",
    description: "",
});
const articleSubmitting = ref(false);
const articleError = ref("");
const showPoemForm = ref(false);
const poemForm = ref({
    title: "",
    authors: "",
    status: "backlog",
    number_of_pages: "",
    publish_date: "",
    description: "",
});
const poemSubmitting = ref(false);
const poemError = ref("");
const activityDates = ref([]);
const calendarMonth = ref(new Date().getMonth()); // 0-11
const calendarYear = ref(new Date().getFullYear());
const historyMinimized = ref(false);
const searchMode = ref("title"); // "title" | "isbn"
const titleQuery = ref("");
const authorQuery = ref("");
const searchResults = ref([]);
const monthSummary = ref({ pages_read: 0, pages_recorded: 0, items_finished: [], dates: [] });
const viewBookItem = ref(null);
const confirmationMessage = ref(null);
const showCelebration = ref(false);
const celebrationCover = ref(null);
const lightboxSrc = ref(null);

const finishMessages = [
    "Another one down!",
    "Well read!",
    "Knowledge unlocked!",
    "You crushed it!",
    "Page-turner conquered!",
    "One more for the shelf!",
    "Bookworm level up!",
    "That's a wrap!",
    "Finished and fabulous!",
    "Reading streak!",
];

export function useBookLog() {
    const canSubmit = computed(() => {
        const cleaned = (isbn.value || "").replace(/[\s-]/g, "");
        return cleaned.length >= 10 && /^\d+$/.test(cleaned);
    });

    const canSearchByTitle = computed(() =>
        titleQuery.value.trim().length > 0 || authorQuery.value.trim().length > 0,
    );

    const today = computed(() => new Date().toISOString().slice(0, 10));

    const backlogBooks = computed(() =>
        backlog.value.filter((b) => !b.entry_type || b.entry_type === "book"),
    );
    const backlogArticles = computed(() =>
        backlog.value.filter((b) => b.entry_type === "article"),
    );
    const backlogPoems = computed(() =>
        backlog.value.filter((b) => b.entry_type === "poem"),
    );
    const inProgressBooks = computed(() =>
        inProgress.value.filter((b) => !b.entry_type || b.entry_type === "book"),
    );
    const inProgressArticles = computed(() =>
        inProgress.value.filter((b) => b.entry_type === "article"),
    );
    const inProgressPoems = computed(() =>
        inProgress.value.filter((b) => b.entry_type === "poem"),
    );
    const finishedBooks = computed(() =>
        finished.value.filter((b) => !b.entry_type || b.entry_type === "book"),
    );
    const finishedArticles = computed(() =>
        finished.value.filter((b) => b.entry_type === "article"),
    );
    const finishedPoems = computed(() =>
        finished.value.filter((b) => b.entry_type === "poem"),
    );

    const calendarMonthName = computed(() => {
        const d = new Date(calendarYear.value, calendarMonth.value, 1);
        return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    });

    const calendarDays = computed(() => {
        const year = calendarYear.value;
        const month = calendarMonth.value;
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        const startPad = first.getDay();
        const daysInMonth = last.getDate();
        const set = new Set(activityDates.value);
        const days = [];
        for (let i = 0; i < startPad; i++) days.push({ empty: true });
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            days.push({ day: d, dateStr, active: set.has(dateStr), empty: false });
        }
        return days;
    });

    function formatDate(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr + "T12:00:00");
        return d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    function formatDateTime(isoStr) {
        if (!isoStr) return "";
        const d = new Date(isoStr);
        return d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    async function loadHistory() {
        try {
            const { data, error: err } = await supabase
                .from("books")
                .select("*")
                .not("last_looked_up", "is", null)
                .order("last_looked_up", { ascending: false })
                .limit(20);
            if (!err && data) history.value = data;
        } catch {
            history.value = [];
        }
    }

    async function loadBacklog() {
        try {
            const { data, error: err } = await supabase
                .from("books")
                .select("*")
                .eq("status", "backlog")
                .order("backlog_order", { ascending: true });
            if (!err && data) backlog.value = data;
        } catch {
            backlog.value = [];
        }
    }

    async function loadInProgress() {
        try {
            const { data, error: err } = await supabase
                .from("books")
                .select("*")
                .eq("status", "in_progress")
                .order("started_date", { ascending: false });
            if (!err && data) inProgress.value = data;
        } catch {
            inProgress.value = [];
        }
    }

    async function loadFinished() {
        try {
            const { data, error: err } = await supabase
                .from("books")
                .select("*")
                .eq("status", "finished")
                .order("finished_date", { ascending: false });
            if (!err && data) finished.value = data;
        } catch {
            finished.value = [];
        }
    }

    async function loadStats() {
        try {
            const clientToday = new Date().toISOString().slice(0, 10);
            const year = parseInt(clientToday.slice(0, 4));
            const month = parseInt(clientToday.slice(5, 7));
            const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
            const startOfYear = `${year}-01-01`;

            const [finishedResult, progressMonthResult, progressYearResult] = await Promise.all([
                supabase
                    .from("books")
                    .select("entry_type, number_of_pages, finished_date")
                    .eq("status", "finished"),
                supabase
                    .from("progress_events")
                    .select("delta")
                    .gte("date", startOfMonth)
                    .lte("date", clientToday),
                supabase
                    .from("progress_events")
                    .select("delta")
                    .gte("date", startOfYear)
                    .lte("date", clientToday),
            ]);

            const finishedItems = finishedResult.data || [];

            let books_finished_count = 0;
            let articles_finished_count = 0;
            let poems_finished_count = 0;
            let pages_from_finished_month = 0;
            let pages_from_finished_year = 0;

            for (const item of finishedItems) {
                const type = item.entry_type || "book";
                if (type === "book") books_finished_count++;
                else if (type === "article") articles_finished_count++;
                else if (type === "poem") poems_finished_count++;

                const pages = typeof item.number_of_pages === "number" ? item.number_of_pages : 0;
                const fd = item.finished_date ? String(item.finished_date).slice(0, 10) : null;
                if (fd && fd >= startOfMonth) pages_from_finished_month += pages;
                if (fd && fd >= startOfYear) pages_from_finished_year += pages;
            }

            const pages_recorded_this_month = (progressMonthResult.data || [])
                .reduce((sum, ev) => sum + (ev.delta || 0), 0);
            const pages_recorded_this_year = (progressYearResult.data || [])
                .reduce((sum, ev) => sum + (ev.delta || 0), 0);

            stats.value = {
                pages_this_month: pages_from_finished_month + pages_recorded_this_month,
                pages_this_year: pages_from_finished_year + pages_recorded_this_year,
                pages_from_finished_this_month: pages_from_finished_month,
                pages_from_finished_this_year: pages_from_finished_year,
                pages_recorded_this_month,
                pages_recorded_this_year,
                books_finished_count,
                articles_finished_count,
                poems_finished_count,
                items_finished_count: finishedItems.length,
            };
        } catch {}
    }

    async function loadActivityDates() {
        try {
            const todayStr = new Date().toISOString().slice(0, 10);
            const { data, error: err } = await supabase
                .from("books")
                .select("started_date, finished_date, last_progress_date")
                .or("started_date.not.is.null,finished_date.not.is.null,last_progress_date.not.is.null");

            const computed = new Set();
            if (!err && data) {
                for (const doc of data) {
                    for (const key of ["started_date", "finished_date", "last_progress_date"]) {
                        const val = doc[key];
                        if (val) {
                            const dateStr = String(val).slice(0, 10);
                            if (dateStr <= todayStr) computed.add(dateStr);
                        }
                    }
                }
            }

            const result = new Set(computed);
            const { data: overrides } = await supabase
                .from("calendar_overrides")
                .select("date, show");
            if (overrides) {
                for (const o of overrides) {
                    if (o.show) result.add(o.date);
                    else result.delete(o.date);
                }
            }

            activityDates.value = [...result].sort();
        } catch {
            activityDates.value = [];
        }
    }

    async function toggleCalendarDay(dateStr) {
        const currentlyActive = activityDates.value.includes(dateStr);
        try {
            await supabase
                .from("calendar_overrides")
                .upsert({ date: dateStr, show: !currentlyActive });
            await loadActivityDates();
        } catch {
            await loadActivityDates();
        }
    }

    async function deleteFromRead(isbnVal) {
        if (!confirm("Delete this item and clear it from history? This cannot be undone.")) return;
        try {
            const { error: err } = await supabase
                .from("books")
                .delete()
                .eq("isbn", isbnVal);
            if (err) throw new Error(err.message);
            await refreshReadingLog();
            await loadHistory();
        } catch (e) {
            error.value = e.message || "Failed to delete";
        }
    }

    async function loadMonthSummary(year, month) {
        const m = typeof month === "number" ? month + 1 : month; // 0-11 -> 1-12
        const startDate = `${year}-${String(m).padStart(2, "0")}-01`;
        const lastDay = new Date(year, m, 0).getDate();
        const endDate = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        try {
            const [finishedResult, activityResult, progressResult] = await Promise.all([
                supabase
                    .from("books")
                    .select("*")
                    .eq("status", "finished")
                    .gte("finished_date", startDate)
                    .lte("finished_date", endDate),
                supabase
                    .from("books")
                    .select("started_date, finished_date, last_progress_date")
                    .or("started_date.not.is.null,finished_date.not.is.null,last_progress_date.not.is.null"),
                supabase
                    .from("progress_events")
                    .select("delta")
                    .gte("date", startDate)
                    .lte("date", endDate),
            ]);

            const items = finishedResult.data || [];
            const pagesRead = items.reduce(
                (sum, item) => sum + (typeof item.number_of_pages === "number" ? item.number_of_pages : 0),
                0,
            );

            const pagesRecorded = (progressResult.data || [])
                .reduce((sum, ev) => sum + (ev.delta || 0), 0);

            const datesInMonth = new Set();
            if (activityResult.data) {
                for (const doc of activityResult.data) {
                    for (const key of ["started_date", "finished_date", "last_progress_date"]) {
                        const val = doc[key];
                        if (val) {
                            const ds = String(val).slice(0, 10);
                            if (ds >= startDate && ds <= endDate) datesInMonth.add(ds);
                        }
                    }
                }
            }

            monthSummary.value = {
                pages_read: pagesRead,
                pages_recorded: pagesRecorded,
                items_finished: items,
                dates: [...datesInMonth].sort(),
            };
        } catch {
            monthSummary.value = { pages_read: 0, pages_recorded: 0, items_finished: [], dates: [] };
        }
    }

    async function refreshReadingLog() {
        await Promise.all([
            loadBacklog(),
            loadInProgress(),
            loadFinished(),
            loadStats(),
            loadActivityDates(),
        ]);
    }

    function isArticle(item) {
        return item && item.entry_type === "article";
    }

    function isPoem(item) {
        return item && item.entry_type === "poem";
    }

    async function getNextBacklogOrder() {
        const { data } = await supabase
            .from("books")
            .select("backlog_order")
            .eq("status", "backlog")
            .order("backlog_order", { ascending: false })
            .limit(1)
            .maybeSingle();
        return data?.backlog_order != null ? data.backlog_order + 1 : 0;
    }

    async function submitArticle() {
        const title = (articleForm.value.title || "").trim();
        if (!title) {
            articleError.value = "Title is required";
            return;
        }
        articleError.value = "";
        articleSubmitting.value = true;
        try {
            const authors = articleForm.value.authors
                ? articleForm.value.authors.split(",").map((s) => s.trim()).filter(Boolean)
                : undefined;
            const status = articleForm.value.status || "backlog";
            const articleId = `article-${crypto.randomUUID().replace(/-/g, "")}`;
            const row = {
                isbn: articleId,
                entry_type: "article",
                title,
                authors: authors?.length ? authors : ["Unknown"],
                publishers: [],
                subjects: [],
                status,
                number_of_pages: articleForm.value.number_of_pages
                    ? parseInt(articleForm.value.number_of_pages, 10) : null,
                publish_date: (articleForm.value.publish_date || "").trim() || null,
                description: (articleForm.value.description || "").trim() || null,
                format: articleForm.value.format || null,
            };
            if (status === "backlog") {
                row.backlog_order = await getNextBacklogOrder();
                row.backlog_date = today.value;
            } else if (status === "in_progress") {
                row.started_date = today.value;
            } else if (status === "finished") {
                row.finished_date = today.value;
            }
            const { error: err } = await supabase.from("books").insert(row);
            if (err) throw new Error(err.message);
            articleForm.value = {
                title: "", authors: "", status: "backlog", number_of_pages: "",
                publish_date: "", description: "", format: "",
            };
            showArticleForm.value = false;
            await refreshReadingLog();
            await loadHistory();
        } catch (e) {
            articleError.value = e.message || "Something went wrong";
        } finally {
            articleSubmitting.value = false;
        }
    }

    async function submitPoem() {
        const title = (poemForm.value.title || "").trim();
        if (!title) {
            poemError.value = "Title is required";
            return;
        }
        poemError.value = "";
        poemSubmitting.value = true;
        try {
            const authors = poemForm.value.authors
                ? poemForm.value.authors.split(",").map((s) => s.trim()).filter(Boolean)
                : undefined;
            const status = poemForm.value.status || "backlog";
            const poemId = `article-${crypto.randomUUID().replace(/-/g, "")}`;
            const row = {
                isbn: poemId,
                entry_type: "poem",
                title,
                authors: authors?.length ? authors : ["Unknown"],
                publishers: [],
                subjects: [],
                status,
                number_of_pages: poemForm.value.number_of_pages
                    ? parseInt(poemForm.value.number_of_pages, 10) : null,
                publish_date: (poemForm.value.publish_date || "").trim() || null,
                description: (poemForm.value.description || "").trim() || null,
                format: poemForm.value.format || null,
            };
            if (status === "backlog") {
                row.backlog_order = await getNextBacklogOrder();
                row.backlog_date = today.value;
            } else if (status === "in_progress") {
                row.started_date = today.value;
            } else if (status === "finished") {
                row.finished_date = today.value;
            }
            const { error: err } = await supabase.from("books").insert(row);
            if (err) throw new Error(err.message);
            poemForm.value = {
                title: "", authors: "", status: "backlog", number_of_pages: "",
                publish_date: "", description: "", format: "",
            };
            showPoemForm.value = false;
            await refreshReadingLog();
            await loadHistory();
        } catch (e) {
            poemError.value = e.message || "Something went wrong";
        } finally {
            poemSubmitting.value = false;
        }
    }

    async function lookup() {
        if (!canSubmit.value) return;
        error.value = null;
        book.value = null;
        loading.value = true;
        try {
            const cleaned = isbn.value.replace(/[\s-]/g, "");

            // Check local DB first - skip edge function entirely if we already have it
            const { data: cached } = await supabase
                .from("books")
                .select("*")
                .eq("isbn", cleaned)
                .maybeSingle();

            if (cached) {
                book.value = cached;
                // Touch last_looked_up in background
                supabase
                    .from("books")
                    .update({ last_looked_up: new Date().toISOString() })
                    .eq("isbn", cleaned)
                    .then(() => loadHistory());
                await refreshReadingLog();
                return;
            }

            // Not in DB - fetch via edge function (hits Google Books / Open Library)
            const { data, error: fnError } = await supabase.functions.invoke(`isbn-lookup/${cleaned}`, { method: 'GET' });
            if (fnError) throw new Error(fnError.message || "Book not found");
            if (data?.error) throw new Error(data.error);
            book.value = data;
            await loadHistory();
            await refreshReadingLog();
        } catch (e) {
            error.value = e.message || "Something went wrong";
        } finally {
            loading.value = false;
        }
    }

    async function searchByTitle() {
        if (!canSearchByTitle.value) return;
        error.value = null;
        book.value = null;
        searchResults.value = [];
        loading.value = true;
        try {
            const params = new URLSearchParams();
            if (titleQuery.value.trim()) params.set("title", titleQuery.value.trim());
            if (authorQuery.value.trim()) params.set("author", authorQuery.value.trim());
            const { data, error: fnError } = await supabase.functions.invoke(
                `book-search?${params}`,
                { method: "GET" },
            );
            if (fnError) throw new Error(fnError.message || "Search failed");
            if (data?.error) throw new Error(data.error);
            searchResults.value = Array.isArray(data) ? data : [];
            if (searchResults.value.length === 0) {
                error.value = "No books found for that search.";
            }
        } catch (e) {
            error.value = e.message || "Something went wrong";
        } finally {
            loading.value = false;
        }
    }

    async function selectSearchResult(result) {
        searchResults.value = [];
        if (result.isbn) {
            // Check if we already have this book in the DB
            const { data: cached } = await supabase
                .from("books")
                .select("*")
                .eq("isbn", result.isbn)
                .maybeSingle();

            if (cached) {
                isbn.value = result.isbn;
                book.value = cached;
                supabase
                    .from("books")
                    .update({ last_looked_up: new Date().toISOString() })
                    .eq("isbn", result.isbn)
                    .then(() => loadHistory());
                return;
            }

            isbn.value = result.isbn;
            await lookup();
        } else {
            book.value = result;
        }
    }

    async function refreshMetadata() {
        if (!book.value?.isbn) return;
        error.value = null;
        loading.value = true;
        try {
            // Always hit the edge function to re-fetch from Google Books
            const { data, error: fnError } = await supabase.functions.invoke(`isbn-lookup/${book.value.isbn}?refresh=1`, { method: 'GET' });
            if (fnError) throw new Error(fnError.message || "Refresh failed");
            if (data?.error) throw new Error(data.error);
            book.value = data;
            await loadHistory();
            await refreshReadingLog();
        } catch (e) {
            error.value = e.message || "Something went wrong";
        } finally {
            loading.value = false;
        }
    }

    function lookupFromHistory(item) {
        // Already have full data from the history list - no need to re-fetch
        isbn.value = item.isbn;
        book.value = item;
        supabase
            .from("books")
            .update({ last_looked_up: new Date().toISOString() })
            .eq("isbn", item.isbn)
            .then(() => loadHistory());
    }

    async function addToBacklog(format) {
        if (!book.value?.isbn) return;
        try {
            const payload = { status: "backlog", backlog_date: today.value };
            if (format) payload.format = format;
            const { error: err } = await supabase
                .from("books")
                .update(payload)
                .eq("isbn", book.value.isbn);
            if (err) throw new Error(err.message);
            const title = book.value.title;
            book.value = null;
            await refreshReadingLog();
            await loadHistory();
            confirmationMessage.value = `"${title}" added to backlog`;
            setTimeout(() => { confirmationMessage.value = null; }, 3000);
        } catch (e) {
            error.value = e.message;
        }
    }

    async function startReading(isbnVal) {
        try {
            const { error: err } = await supabase
                .from("books")
                .update({ status: "in_progress", current_page: 0, started_date: today.value })
                .eq("isbn", isbnVal);
            if (err) throw new Error(err.message);
            await refreshReadingLog();
        } catch {
            error.value = "Failed to start reading";
        }
    }

    async function startReadingFromLookup(format) {
        if (!book.value?.isbn) return;
        try {
            const payload = { status: "in_progress", current_page: 0, started_date: today.value };
            if (format) payload.format = format;
            const { error: err } = await supabase
                .from("books")
                .update(payload)
                .eq("isbn", book.value.isbn);
            if (err) throw new Error(err.message);
            const title = book.value.title;
            book.value = null;
            await refreshReadingLog();
            await loadHistory();
            confirmationMessage.value = `Started reading "${title}"`;
            setTimeout(() => { confirmationMessage.value = null; }, 3000);
        } catch (e) {
            error.value = e.message;
        }
    }

    /**
     * Parse page input, allowing math like "+20" (add to current) or "144+20".
     * Returns the resolved page number or null if invalid.
     */
    function parsePageInput(inputStr, currentPage) {
        const raw = String(inputStr ?? "").trim();
        if (raw === "") return null;
        const cur = currentPage ?? 0;
        if (/^\+\s*\d+$/.test(raw)) {
            const delta = parseInt(raw.replace(/\s/g, "").slice(1), 10);
            return cur + delta;
        }
        if (/^[\d\s+]+$/.test(raw)) {
            const parts = raw.split("+").map((s) => parseInt(s.trim(), 10));
            if (parts.every((n) => !Number.isNaN(n))) {
                return parts.reduce((a, b) => a + b, 0);
            }
        }
        const page = parseInt(raw, 10);
        if (!Number.isNaN(page) && page >= 0) return page;
        return null;
    }

    async function updateProgress(isbnVal, currentPageInput, currentPageCurrent) {
        const prevPage = currentPageCurrent ?? 0;
        const page = parsePageInput(currentPageInput, prevPage);
        if (page === null || page < 0) return;
        const delta = page - prevPage;
        try {
            const { data: updated, error: err } = await supabase
                .from("books")
                .update({ current_page: page, last_progress_date: today.value })
                .eq("isbn", isbnVal)
                .select()
                .single();
            if (err) return;

            // Record the page delta for stats tracking
            if (delta !== 0) {
                await supabase.from("progress_events").insert({
                    isbn: isbnVal,
                    date: today.value,
                    delta,
                });
            }

            const idx = inProgress.value.findIndex((b) => b.isbn === isbnVal);
            if (idx !== -1) {
                inProgress.value = [
                    ...inProgress.value.slice(0, idx),
                    updated,
                    ...inProgress.value.slice(idx + 1),
                ];
            } else {
                await loadInProgress();
            }
            await Promise.all([
                loadActivityDates(),
                loadStats(),
                loadMonthSummary(calendarYear.value, calendarMonth.value),
            ]);
        } catch {}
    }

    async function updateFormat(isbnVal, fmt) {
        const newFormat = fmt || null;
        try {
            const { error: err } = await supabase
                .from("books")
                .update({ format: newFormat })
                .eq("isbn", isbnVal);
            if (err) return;
            for (const list of [inProgress, backlog, finished]) {
                const idx = list.value.findIndex((b) => b.isbn === isbnVal);
                if (idx !== -1) {
                    list.value[idx] = { ...list.value[idx], format: newFormat };
                }
            }
        } catch {}
    }

    function openFinishModal(isbnVal, title, coverUrl) {
        viewBookItem.value = null; // close view modal if open
        editBook.value = { isbn: isbnVal, title: title || null, cover_url: coverUrl || null };
        finishDate.value = today.value;
        showFinishModal.value = true;
    }

    async function markFinishedFromLookup() {
        if (!book.value?.isbn) return;
        editBook.value = { isbn: book.value.isbn, title: book.value.title, cover_url: book.value.cover_url || null };
        finishDate.value = today.value;
        book.value = null; // close the lookup modal first
        showFinishModal.value = true;
    }

    async function confirmMarkFinished() {
        if (!editBook.value?.isbn || !finishDate.value) return;
        try {
            const { error: err } = await supabase
                .from("books")
                .update({ status: "finished", finished_date: finishDate.value })
                .eq("isbn", editBook.value.isbn);
            if (err) throw new Error(err.message);
            const title = editBook.value.title;
            const cover = editBook.value.cover_url;
            showFinishModal.value = false;
            editBook.value = null;
            await refreshReadingLog();
            await loadHistory();
            const msg = finishMessages[Math.floor(Math.random() * finishMessages.length)];
            confirmationMessage.value = title ? `"${title}" finished — ${msg}` : msg;
            celebrationCover.value = cover || null;
            showCelebration.value = true;
            setTimeout(() => {
                confirmationMessage.value = null;
                showCelebration.value = false;
                celebrationCover.value = null;
            }, 4000);
        } catch (e) {
            error.value = e.message;
        }
    }

    async function removeFromList(isbnVal) {
        if (!confirm("Remove from list? Progress (e.g. pages read) is kept.")) return;
        try {
            const { error: err } = await supabase
                .from("books")
                .update({ status: null })
                .eq("isbn", isbnVal);
            if (err) throw new Error(err.message);
            await refreshReadingLog();
        } catch (e) {
            error.value = e.message;
        }
    }

    function progressPercent(item) {
        const total = item.number_of_pages;
        const current = item.current_page ?? 0;
        if (!total || total <= 0) return 0;
        return Math.min(100, Math.round((current / total) * 100));
    }

    function backlogSectionType(item) {
        return item.entry_type === "article"
            ? "article"
            : item.entry_type === "poem"
              ? "poem"
              : "book";
    }

    function onBacklogDragStart(e, item) {
        draggedIsbn.value = item.isbn;
        draggedSection.value = backlogSectionType(item);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.isbn);
    }

    function onBacklogDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    }

    function mergeBacklogOrder(fullList, newSectionItems, sectionType) {
        let j = 0;
        return fullList.map((item) =>
            backlogSectionType(item) === sectionType ? newSectionItems[j++] : item,
        );
    }

    async function moveBacklogItemToPosition(isbnVal, sectionType, newPosition) {
        const sectionItems =
            sectionType === "article"
                ? backlogArticles.value
                : sectionType === "poem"
                  ? backlogPoems.value
                  : backlogBooks.value;
        const currentIndex = sectionItems.findIndex((i) => i.isbn === isbnVal);
        if (currentIndex === -1) return;
        const newIndex = Math.max(0, Math.min(sectionItems.length - 1, newPosition - 1));
        if (newIndex === currentIndex) return;
        const reordered = [...sectionItems];
        const [removed] = reordered.splice(currentIndex, 1);
        reordered.splice(newIndex, 0, removed);
        const fullOrder = mergeBacklogOrder(backlog.value, reordered, sectionType);
        try {
            const updates = fullOrder.map((item, idx) =>
                supabase.from("books").update({ backlog_order: idx }).eq("isbn", item.isbn)
            );
            await Promise.all(updates);
            await loadBacklog();
        } catch {
            error.value = "Failed to reorder";
        }
    }

    async function moveBacklogItem(isbnVal, sectionType, direction) {
        const sectionItems =
            sectionType === "article"
                ? backlogArticles.value
                : sectionType === "poem"
                  ? backlogPoems.value
                  : backlogBooks.value;
        const currentIndex = sectionItems.findIndex((i) => i.isbn === isbnVal);
        if (currentIndex === -1) return;
        const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= sectionItems.length) return;
        const reordered = [...sectionItems];
        const [removed] = reordered.splice(currentIndex, 1);
        reordered.splice(newIndex, 0, removed);
        const fullOrder = mergeBacklogOrder(backlog.value, reordered, sectionType);
        try {
            const updates = fullOrder.map((item, idx) =>
                supabase.from("books").update({ backlog_order: idx }).eq("isbn", item.isbn)
            );
            await Promise.all(updates);
            await loadBacklog();
        } catch {
            error.value = "Failed to reorder";
        }
    }

    async function onBacklogDrop(e, sectionType, dropIndex) {
        e.preventDefault();
        const isbnVal = draggedIsbn.value;
        const section = draggedSection.value;
        draggedIsbn.value = null;
        draggedSection.value = null;
        if (!isbnVal || section !== sectionType) return;
        const sectionItems =
            sectionType === "article"
                ? backlogArticles.value
                : sectionType === "poem"
                  ? backlogPoems.value
                  : backlogBooks.value;
        const fromIndex = sectionItems.findIndex((i) => i.isbn === isbnVal);
        if (fromIndex === -1) return;
        const reordered = [...sectionItems];
        const [removed] = reordered.splice(fromIndex, 1);
        reordered.splice(dropIndex, 0, removed);
        const fullOrder = mergeBacklogOrder(backlog.value, reordered, sectionType);
        try {
            const updates = fullOrder.map((item, idx) =>
                supabase.from("books").update({ backlog_order: idx }).eq("isbn", item.isbn)
            );
            await Promise.all(updates);
            await loadBacklog();
        } catch {
            error.value = "Failed to reorder";
        }
    }

    function openEdit(b) {
        if (!b) {
            editBookForEdit.value = null;
            return;
        }
        const copy = { ...b };
        const dateKeys = ["started_date", "finished_date", "backlog_date"];
        for (const key of dateKeys) {
            if (copy[key] != null) {
                const s = String(copy[key]).slice(0, 10);
                copy[key] = s.length >= 10 ? s : copy[key];
            }
        }
        editBookForEdit.value = copy;
    }

    async function saveEdit() {
        if (!editBookForEdit.value?.isbn) return;
        const b = editBookForEdit.value;
        const payload = {
            title: b.title ?? undefined,
            authors: b.authors ?? undefined,
            publishers: b.publishers ?? undefined,
            publish_date: b.publish_date ?? undefined,
            number_of_pages: b.number_of_pages != null ? Number(b.number_of_pages) : undefined,
            description: b.description ?? undefined,
            format: b.format || null,
            status: b.status ?? undefined,
            current_page: b.current_page != null ? Number(b.current_page) : undefined,
            started_date:
                b.started_date && String(b.started_date).slice(0, 10)
                    ? String(b.started_date).slice(0, 10)
                    : undefined,
            backlog_date:
                b.backlog_date && String(b.backlog_date).slice(0, 10)
                    ? String(b.backlog_date).slice(0, 10)
                    : undefined,
            finished_date:
                b.finished_date && String(b.finished_date).slice(0, 10)
                    ? String(b.finished_date).slice(0, 10)
                    : undefined,
        };
        try {
            const { data: updated, error: err } = await supabase
                .from("books")
                .update(payload)
                .eq("isbn", b.isbn)
                .select()
                .single();
            if (err) throw new Error(err.message);
            editBookForEdit.value = null;
            await refreshReadingLog();
            await loadHistory();
            if (book.value?.isbn === b.isbn) {
                book.value = updated;
            }
        } catch (e) {
            error.value = e.message;
        }
    }

    function calendarPrevMonth() {
        if (calendarMonth.value === 0) {
            calendarMonth.value = 11;
            calendarYear.value--;
        } else {
            calendarMonth.value--;
        }
        loadMonthSummary(calendarYear.value, calendarMonth.value);
    }

    function calendarNextMonth() {
        if (calendarMonth.value === 11) {
            calendarMonth.value = 0;
            calendarYear.value++;
        } else {
            calendarMonth.value++;
        }
        loadMonthSummary(calendarYear.value, calendarMonth.value);
    }

    function closeFinishModal() {
        showFinishModal.value = false;
    }

    function closeEditModal() {
        editBookForEdit.value = null;
    }

    function openViewModal(item) {
        viewBookItem.value = item;
    }

    function closeViewModal() {
        viewBookItem.value = null;
    }

    function clearBook() {
        book.value = null;
    }

    function hiResCoverUrl(url) {
        if (!url) return url;
        if (url.includes("books.google.com") || url.includes("googleapis.com/books")) {
            return url.replace(/zoom=\d/, "zoom=0").replace(/&edge=curl/, "");
        }
        return url;
    }

    function openLightbox(coverUrl, isbnVal) {
        const hiRes = hiResCoverUrl(coverUrl);
        lightboxSrc.value = hiRes;
        if (isbnVal && /^\d{10,13}$/.test(isbnVal)) {
            const olUrl = `https://covers.openlibrary.org/b/isbn/${isbnVal}-L.jpg`;
            const img = new Image();
            img.onload = () => {
                if (img.naturalWidth > 10) lightboxSrc.value = olUrl;
            };
            img.src = olUrl;
        }
    }

    function closeLightbox() {
        lightboxSrc.value = null;
    }

    function init() {
        loadHistory();
        refreshReadingLog();
        loadMonthSummary(calendarYear.value, calendarMonth.value);
    }

    return {
        isbn,
        searchMode,
        titleQuery,
        authorQuery,
        searchResults,
        canSearchByTitle,
        book,
        loading,
        error,
        history,
        backlog,
        inProgress,
        finished,
        stats,
        editBook,
        editBookForEdit,
        finishDate,
        showFinishModal,
        showArticleForm,
        articleForm,
        articleSubmitting,
        articleError,
        showPoemForm,
        poemForm,
        poemSubmitting,
        poemError,
        activityDates,
        calendarMonth,
        calendarYear,
        historyMinimized,
        canSubmit,
        today,
        backlogBooks,
        backlogArticles,
        backlogPoems,
        inProgressBooks,
        inProgressArticles,
        inProgressPoems,
        finishedBooks,
        finishedArticles,
        finishedPoems,
        calendarMonthName,
        calendarDays,
        formatDate,
        formatDateTime,
        isArticle,
        isPoem,
        loadHistory,
        refreshReadingLog,
        submitArticle,
        submitPoem,
        lookup,
        searchByTitle,
        selectSearchResult,
        refreshMetadata,
        lookupFromHistory,
        addToBacklog,
        startReading,
        startReadingFromLookup,
        updateProgress,
        updateFormat,
        openFinishModal,
        markFinishedFromLookup,
        confirmMarkFinished,
        removeFromList,
        progressPercent,
        onBacklogDragStart,
        onBacklogDragOver,
        onBacklogDrop,
        moveBacklogItem,
        moveBacklogItemToPosition,
        openEdit,
        saveEdit,
        calendarPrevMonth,
        calendarNextMonth,
        toggleCalendarDay,
        deleteFromRead,
        loadActivityDates,
        monthSummary,
        loadMonthSummary,
        closeFinishModal,
        closeEditModal,
        viewBookItem,
        openViewModal,
        closeViewModal,
        clearBook,
        confirmationMessage,
        showCelebration,
        celebrationCover,
        lightboxSrc,
        openLightbox,
        closeLightbox,
        init,
    };
}
