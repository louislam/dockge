import { createRouter, createWebHistory } from "vue-router";

import Layout from "./layouts/Layout.vue";
import Setup from "./pages/Setup.vue";
import Dashboard from "./pages/Dashboard.vue";
import DashboardHome from "./pages/DashboardHome.vue";
import Compose from "./pages/Compose.vue";
import ContainerTerminal from "./pages/ContainerTerminal.vue";

const Settings = () => import("./pages/Settings.vue");

// Settings - Sub Pages
import General from "./components/settings/General.vue";
const Security = () => import("./components/settings/Security.vue");
const Scanner = () => import("./components/settings/Scanner.vue");
import About from "./components/settings/About.vue";

const routes = [
    {
        path: "/empty",
        component: Layout,
        children: [
            {
                path: "",
                component: Dashboard,
                children: [
                    {
                        name: "DashboardHome",
                        path: "/",
                        component: DashboardHome,
                        children: [
                            {
                                path: "/compose",
                                component: Compose,
                            },
                            {
                                path: "/images",
                                component: () => import("./pages/Images.vue"),
                                name: "DockerImages",
                            },
                            {
                                path: "/compose/:stackName/:endpoint",
                                component: Compose,
                            },
                            {
                                path: "/compose/:stackName",
                                component: Compose,
                            },
                            {
                                path: "/terminal/:stackName/:serviceName/:type",
                                component: ContainerTerminal,
                                name: "containerTerminal",
                            },
                            {
                                path: "/terminal/:stackName/:serviceName/:type/:endpoint",
                                component: ContainerTerminal,
                                name: "containerTerminalEndpoint",
                            },
                        ]
                    },
                    {
                        path: "/settings",
                        component: Settings,
                        children: [
                            {
                                path: "general",
                                component: General,
                            },
                            {
                                path: "security",
                                component: Security,
                            },
                            {
                                path: "scanner",
                                component: Scanner,
                            },
                            {
                                path: "about",
                                component: About,
                            },
                        ]
                    },
                ]
            },
        ]
    },
    {
        path: "/setup",
        component: Setup,
    },
];

export const router = createRouter({
    linkExactActiveClass: "active",
    history: createWebHistory(),
    routes,
});
