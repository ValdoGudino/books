import { ref, computed } from "vue";
import { useAuth } from "./useAuth";
import { supabase } from "../lib/supabase";

const { getAccessToken } = useAuth();

/** Build headers with JSON content type and Supabase auth token. */
function authHeaders(extra = {}) {
    const headers = { "Content-Type": "application/json", ...extra };
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

/** Wrapper around fetch that attaches the auth token. */
async function authFetch(url, opts = {}) {
    const headers = authHeaders(opts.headers);
    return fetch(url, { ...opts, headers });
}

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
            const res = await authFetch("/api/books/history");
            if (res.ok) history.value = await res.json();
        } catch {
            history.value = [];
        }
    }

    async function loadBacklog() {
        try {
            const res = await authFetch("/api/books/backlog");
            if (res.ok) backlog.value = await res.json();
        } catch {
            backlog.value = [];
        }
    }

    async function loadInProgress() {
        try {
            const res = await authFetch("/api/books/in-progress");
            if (res.ok) inProgress.value = await res.json();
        } catch {
            inProgress.value = [];
        }
    }

    async function loadFinished() {
        try {
            const res = await authFetch("/api/books/finished");
            if (res.ok) finished.value = await res.json();
        } catch {
            finished.value = [];
        }
    }

    async function loadStats() {
        try {
            const clientToday = new Date().toISOString().slice(0, 10);
            const res = await authFetch(`/api/books/stats?today=${encodeURIComponent(clientToday)}`);
            if (res.ok) stats.value = await res.json();
        } catch {}
    }

    async function loadActivityDates() {
        try {
            const res = await authFetch("/api/reading-activity/dates");
            if (res.ok) {
                const data = await res.json();
                const dates = Array.isArray(data.dates) ? data.dates : [];
                activityDates.value = dates.map((d) => String(d).slice(0, 10));
            } else {
                activityDates.value = [];
            }
        } catch {
            activityDates.value = [];
        }
    }

    async function toggleCalendarDay(dateStr) {
        const currentlyActive = activityDates.value.includes(dateStr);
        try {
            const res = await authFetch("/api/reading-activity/calendar-override", {
                method: "PUT",
                body: JSON.stringify({ date: dateStr, show: !currentlyActive }),
            });
            if (res.ok) {
                const data = await res.json();
                const next = Array.isArray(data.dates) ? data.dates.map((d) => String(d).slice(0, 10)) : [];
                activityDates.value = next;
            } else {
                await loadActivityDates();
            }
        } catch {
            await loadActivityDates();
        }
    }

    async function deleteFromRead(isbnVal) {
        if (!confirm("Delete this item and clear it from history? This cannot be undone.")) return;
        try {
            const res = await authFetch(`/api/books/${encodeURIComponent(isbnVal)}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed");
            await refreshReadingLog();
            await loadHistory();
        } catch (e) {
            error.value = e.message || "Failed to delete";
        }
    }

    async function loadMonthSummary(year, month) {
        const m = typeof month === "number" ? month + 1 : month; // 0-11 -> 1-12 for API
        try {
            const res = await authFetch(
                `/api/reading-activity/month?year=${encodeURIComponent(year)}&month=${encodeURIComponent(m)}`,
            );
            if (res.ok) {
                const data = await res.json();
                monthSummary.value = {
                    pages_read: data.pages_read ?? 0,
                    pages_recorded: data.pages_recorded ?? 0,
                    items_finished: data.items_finished ?? [],
                    dates: data.dates ?? [],
                };
            } else {
                monthSummary.value = { pages_read: 0, pages_recorded: 0, items_finished: [], dates: [] };
            }
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
            const body = {
                title,
                entry_type: "article",
                authors: authors?.length ? authors : undefined,
                status: articleForm.value.status || "backlog",
                number_of_pages: articleForm.value.number_of_pages
                    ? parseInt(articleForm.value.number_of_pages, 10)
                    : undefined,
                publish_date: (articleForm.value.publish_date || "").trim() || undefined,
                description: (articleForm.value.description || "").trim() || undefined,
            };
            const res = await authFetch("/api/articles", {
                method: "POST",

                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || res.statusText || "Failed to add article");
            }
            articleForm.value = {
                title: "", authors: "", status: "backlog", number_of_pages: "",
                publish_date: "", description: "",
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
            const body = {
                title,
                entry_type: "poem",
                authors: authors?.length ? authors : undefined,
                status: poemForm.value.status || "backlog",
                number_of_pages: poemForm.value.number_of_pages
                    ? parseInt(poemForm.value.number_of_pages, 10)
                    : undefined,
                publish_date: (poemForm.value.publish_date || "").trim() || undefined,
                description: (poemForm.value.description || "").trim() || undefined,
            };
            const res = await authFetch("/api/articles", {
                method: "POST",

                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || res.statusText || "Failed to add poem");
            }
            poemForm.value = {
                title: "", authors: "", status: "backlog", number_of_pages: "",
                publish_date: "", description: "",
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
            const { data, error: fnError } = await supabase.functions.invoke(`isbn-lookup/${cleaned}`);
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
            const res = await authFetch(`/api/books/search?${params}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || res.statusText || "Search failed");
            }
            searchResults.value = await res.json();
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
            const { data, error: fnError } = await supabase.functions.invoke(`isbn-lookup/${book.value.isbn}`);
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
        isbn.value = item.isbn;
        lookup();
    }

    async function addToBacklog() {
        if (!book.value?.isbn) return;
        try {
            const res = await authFetch("/api/books/backlog", {
                method: "POST",

                body: JSON.stringify({ isbn: book.value.isbn }),
            });
            if (!res.ok)
                throw new Error((await res.json().catch(() => ({}))).detail || "Failed");
            await refreshReadingLog();
        } catch (e) {
            error.value = e.message;
        }
    }

    async function startReading(isbnVal) {
        try {
            const res = await authFetch(`/api/books/${encodeURIComponent(isbnVal)}`, {
                method: "PATCH",

                body: JSON.stringify({ status: "in_progress", current_page: 0 }),
            });
            if (!res.ok) throw new Error("Failed");
            await refreshReadingLog();
        } catch {
            error.value = "Failed to start reading";
        }
    }

    async function startReadingFromLookup() {
        if (!book.value?.isbn) return;
        try {
            const addRes = await authFetch("/api/books/backlog", {
                method: "POST",

                body: JSON.stringify({ isbn: book.value.isbn }),
            });
            if (!addRes.ok) throw new Error("Add failed");
            await authFetch(`/api/books/${encodeURIComponent(book.value.isbn)}`, {
                method: "PATCH",

                body: JSON.stringify({ status: "in_progress", current_page: 0 }),
            });
            await refreshReadingLog();
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
        const page = parsePageInput(
            currentPageInput,
            currentPageCurrent ?? 0,
        );
        if (page === null || page < 0) return;
        try {
            const res = await authFetch(`/api/books/${encodeURIComponent(isbnVal)}`, {
                method: "PATCH",

                body: JSON.stringify({ current_page: page }),
            });
            if (!res.ok) return;
            const updated = await res.json();
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
            await loadActivityDates();
        } catch {}
    }

    function openFinishModal(isbnVal) {
        editBook.value = { isbn: isbnVal };
        finishDate.value = today.value;
        showFinishModal.value = true;
    }

    async function markFinishedFromLookup() {
        if (!book.value?.isbn) return;
        editBook.value = { isbn: book.value.isbn };
        finishDate.value = today.value;
        showFinishModal.value = true;
    }

    async function confirmMarkFinished() {
        if (!editBook.value?.isbn || !finishDate.value) return;
        try {
            const res = await authFetch(
                `/api/books/${encodeURIComponent(editBook.value.isbn)}`,
                {
                    method: "PATCH",
    
                    body: JSON.stringify({
                        status: "finished",
                        finished_date: finishDate.value,
                    }),
                },
            );
            if (!res.ok) throw new Error("Failed");
            showFinishModal.value = false;
            editBook.value = null;
            await refreshReadingLog();
        } catch (e) {
            error.value = e.message;
        }
    }

    async function removeFromList(isbnVal) {
        if (!confirm("Remove from list? Progress (e.g. pages read) is kept.")) return;
        try {
            const res = await authFetch(`/api/books/${encodeURIComponent(isbnVal)}`, {
                method: "PATCH",

                body: JSON.stringify({ status: null }),
            });
            if (!res.ok) throw new Error("Failed");
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
            await authFetch("/api/books/backlog/order", {
                method: "PUT",

                body: JSON.stringify({ isbns: fullOrder.map((i) => i.isbn) }),
            });
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
            await authFetch("/api/books/backlog/order", {
                method: "PUT",

                body: JSON.stringify({ isbns: fullOrder.map((i) => i.isbn) }),
            });
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
            await authFetch("/api/books/backlog/order", {
                method: "PUT",

                body: JSON.stringify({ isbns: fullOrder.map((i) => i.isbn) }),
            });
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
            const res = await authFetch(`/api/books/${encodeURIComponent(b.isbn)}`, {
                method: "PATCH",

                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed");
            editBookForEdit.value = null;
            await refreshReadingLog();
            await loadHistory();
            if (book.value?.isbn === b.isbn) {
                book.value = await res.json();
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
        init,
    };
}
