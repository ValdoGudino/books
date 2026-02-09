import { createRouter, createWebHistory } from "vue-router";
import HomePage from "../pages/HomePage.vue";
import BacklogPage from "../pages/BacklogPage.vue";
import ReadPage from "../pages/ReadPage.vue";
import StatsPage from "../pages/StatsPage.vue";
import LookupPage from "../pages/LookupPage.vue";

const routes = [
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

export default router;
