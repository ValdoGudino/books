import { createRouter, createWebHistory } from "vue-router";
import HomePage from "../pages/HomePage.vue";
import BacklogPage from "../pages/BacklogPage.vue";
import ReadPage from "../pages/ReadPage.vue";
import StatsPage from "../pages/StatsPage.vue";
import LookupPage from "../pages/LookupPage.vue";
import LoginPage from "../pages/LoginPage.vue";
import { useAuth } from "../composables/useAuth";

const routes = [
    { path: "/login", name: "login", component: LoginPage, meta: { public: true } },
    { path: "/", name: "home", component: HomePage, meta: { title: "Currently reading" } },
    { path: "/backlog", name: "backlog", component: BacklogPage, meta: { title: "Backlog" } },
    { path: "/read", name: "read", component: ReadPage, meta: { title: "Read" } },
    { path: "/stats", name: "stats", component: StatsPage, meta: { title: "Stats" } },
    { path: "/lookup", name: "lookup", component: LookupPage, meta: { title: "Look up" } },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

router.beforeEach(async (to) => {
    if (to.meta.public) return true;

    const { user, loading } = useAuth();

    // Wait for the initial auth check to finish
    if (loading.value) {
        await new Promise((resolve) => {
            const stop = setInterval(() => {
                if (!loading.value) {
                    clearInterval(stop);
                    resolve();
                }
            }, 50);
        });
    }

    if (!user.value) {
        return { name: "login" };
    }
    return true;
});

export default router;
