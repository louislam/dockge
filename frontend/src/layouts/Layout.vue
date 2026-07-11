<template>
    <div :class="classes" class="app-layout">
        <div v-if="! $root.socketIO.connected && ! $root.socketIO.firstConnect" class="lost-connection">
            <div class="container-fluid">
                {{ $root.socketIO.connectionErrorMsg }}
                <div v-if="$root.socketIO.showReverseProxyGuide">
                    {{ $t("reverseProxyMsg1") }} <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy" target="_blank">{{ $t("reverseProxyMsg2") }}</a>
                </div>
            </div>
        </div>

        <!-- Left Drawer (Desktop) -->
        <aside v-if="$root.loggedIn" class="nav-drawer d-none d-md-flex">
            <!-- Brand -->
            <router-link to="/" class="brand-section">
                <object class="brand-icon me-2" width="28" height="28" data="/icon.svg" />
                <span class="brand-title">Bockge</span>
            </router-link>

            <!-- Compose Button -->
            <div class="px-3 mb-3">
                <router-link to="/compose" class="btn btn-primary w-100 compose-btn py-2 d-flex align-items-center justify-content-center gap-2">
                    <font-awesome-icon icon="plus" />
                    <span>{{ $t("compose") }}</span>
                </router-link>
            </div>

            <!-- Nav Links -->
            <ul class="drawer-nav">
                <li>
                    <router-link to="/" class="drawer-link" :class="{ active: $route.path === '/' }">
                        <font-awesome-icon icon="home" />
                        <span>{{ $t("home") }}</span>
                    </router-link>
                </li>
                <li>
                    <router-link to="/images" class="drawer-link" :class="{ active: $route.path === '/images' }">
                        <font-awesome-icon icon="images" />
                        <span>Images</span>
                    </router-link>
                </li>
                <li>
                    <router-link to="/settings/general" class="drawer-link" :class="{ active: $route.path.startsWith('/settings') }">
                        <font-awesome-icon icon="cog" />
                        <span>{{ $t("Settings") }}</span>
                    </router-link>
                </li>
            </ul>

            <div class="drawer-divider mx-3 my-3"></div>

            <!-- Scrollable Stack List -->
            <div class="stack-list-wrapper">
                <StackList :scrollbar="true" />
            </div>

            <!-- Profile & Logout -->
            <div class="drawer-footer d-flex align-items-center justify-content-between p-3">
                <div class="d-flex align-items-center gap-2 text-truncate">
                    <div class="profile-pic">{{ $root.usernameFirstChar }}</div>
                    <span class="username-text text-truncate">{{ $root.username }}</span>
                </div>
                <button class="logout-btn" @click="$root.logout" title="Logout">
                    <font-awesome-icon icon="sign-out-alt" />
                </button>
            </div>
        </aside>

        <!-- Right Content / Main App Area -->
        <div class="content-pane">
            <!-- Mobile Header -->
            <header v-if="$root.loggedIn" class="mobile-header d-flex d-md-none align-items-center justify-content-between py-2 px-3 border-bottom">
                <router-link to="/" class="d-flex align-items-center brand-link text-decoration-none">
                    <object class="bi me-2" width="24" height="24" data="/icon.svg" />
                    <span class="fs-5 title">Bockge</span>
                </router-link>

                <div class="d-flex align-items-center">

                    <div v-if="$root.loggedIn" class="dropdown dropdown-profile-pic">
                        <div class="nav-link" data-bs-toggle="dropdown">
                            <div class="profile-pic">{{ $root.usernameFirstChar }}</div>
                        </div>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><span class="dropdown-item-text">Signed in as <strong>{{ $root.username }}</strong></span></li>
                            <li><hr class="dropdown-divider"></li>
                            <li>
                                <router-link to="/settings" class="dropdown-item">
                                    <font-awesome-icon icon="cog" /> {{ $t("Settings") }}
                                </router-link>
                            </li>
                            <li>
                                <button class="dropdown-item text-danger" @click="$root.logout">
                                    <font-awesome-icon icon="sign-out-alt" /> {{ $t("Logout") }}
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </header>

            <!-- Main Content Area -->
            <main class="main-body">
                <div v-if="$root.socketIO.connecting" class="container mt-5">
                    <h4>{{ $t("connecting...") }}</h4>
                </div>

                <router-view v-if="$root.loggedIn" />
                <Login v-if="! $root.loggedIn && $root.allowLoginDialog" />
            </main>
        </div>

        <!-- Mobile Bottom Nav -->
        <div v-if="$root.loggedIn" class="bottom-nav d-block d-md-none">
            <router-link to="/" class="nav-link">
                <div><font-awesome-icon icon="home" /></div>
                {{ $t("home") }}
            </router-link>
            <router-link to="/images" class="nav-link">
                <div><font-awesome-icon icon="images" /></div>
                Images
            </router-link>
            <router-link to="/settings" class="nav-link">
                <div><font-awesome-icon icon="cog" /></div>
                {{ $t("Settings") }}
            </router-link>
        </div>
    </div>
</template>

<script>
import Login from "../components/Login.vue";
import StackList from "../components/StackList.vue";
import { compareVersions } from "compare-versions";
import { ALL_ENDPOINTS } from "../../../common/util-common";

export default {
    components: {
        Login,
        StackList,
    },

    data() {
        return {};
    },

    computed: {
        classes() {
            const classes = {};
            classes[this.$root.theme] = true;
            classes["mobile"] = this.$root.isMobile;
            return classes;
        },

        hasNewVersion() {
            return false;
        },
    },

    methods: {
        scanFolder() {
            this.$root.emitAgent(ALL_ENDPOINTS, "requestStackList", (res) => {
                this.$root.toastRes(res);
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.app-layout {
    display: flex;
    min-height: 100vh;
    width: 100%;
}

.nav-drawer {
    width: 280px;
    min-width: 280px;
    height: 100vh;
    background-color: var(--m3-surface-container);
    border-right: 1px solid rgba(120, 120, 120, 0.15);
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;
}

.brand-section {
    display: flex;
    align-items: center;
    padding: 24px;
    text-decoration: none;
    color: var(--m3-on-surface);

    .brand-title {
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.15px;
    }
}

.compose-btn {
    border-radius: 16px !important;
    font-weight: 600;
}

.drawer-nav {
    list-style: none;
    padding: 0 12px;
    margin: 0;

    li {
        margin-bottom: 4px;
    }
}

.drawer-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: var(--m3-button-radius);
    color: var(--m3-on-surface-variant);
    text-decoration: none;
    font-weight: 500;
    font-size: 14px;
    transition: all 0.2s ease;

    &:hover {
        background-color: rgba(120, 120, 120, 0.08);
        color: var(--m3-on-surface);
    }

    &.active {
        background-color: var(--m3-primary-container) !important;
        color: var(--m3-on-primary-container) !important;
    }
}

.drawer-divider {
    height: 1px;
    background-color: rgba(120, 120, 120, 0.15);
}

.stack-list-wrapper {
    flex-grow: 1;
    overflow-y: auto;
    padding: 8px 12px;
}

.drawer-footer {
    border-top: 1px solid rgba(120, 120, 120, 0.15);
    background-color: rgba(120, 120, 120, 0.02);

    .username-text {
        font-size: 14px;
        font-weight: 500;
        color: var(--m3-on-surface);
        max-width: 140px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
}

.profile-pic {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: var(--m3-primary);
    color: var(--m3-on-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 12px;
}

.logout-btn {
    background: none;
    border: none;
    color: var(--m3-outline);
    font-size: 18px;
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    transition: all 0.2s ease;

    &:hover {
        background-color: rgba(239, 68, 68, 0.08);
        color: #ef4444;
    }
}

.content-pane {
    flex-grow: 1;
    margin-left: 280px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--m3-surface);
}

.main-body {
    flex-grow: 1;
    padding: 0;
}

// Mobile overrides via Media Query (pure CSS)
@media (max-width: 767.98px) {
    .content-pane {
        margin-left: 0 !important;
        padding-bottom: calc(90px + env(safe-area-inset-bottom)) !important;
    }
}

.bottom-nav {
    z-index: 1000;
    position: fixed;
    bottom: 0;
    height: calc(60px + env(safe-area-inset-bottom));
    width: 100%;
    left: 0;
    background-color: var(--m3-surface-container) !important;
    border-top: 1px solid rgba(120, 120, 120, 0.15);
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
    text-align: center;
    white-space: nowrap;
    padding: 0 10px env(safe-area-inset-bottom);

    a {
        text-align: center;
        width: 33.33%;
        display: inline-block;
        height: 100%;
        padding: 8px 10px 0;
        font-size: 13px;
        color: var(--m3-on-surface-variant);
        overflow: hidden;
        text-decoration: none;

        &.router-link-exact-active, &.active {
            color: var(--m3-primary) !important;
            font-weight: bold;

            div {
                background-color: var(--m3-primary-container);
                color: var(--m3-on-primary-container);
            }
        }

        div {
            font-size: 18px;
            border-radius: var(--m3-button-radius);
            padding: 4px 16px;
            display: inline-block;
            transition: background-color 0.2s ease, color 0.2s ease;
        }
    }
}

.lost-connection {
    padding: 5px;
    background-color: var(--m3-danger-container);
    color: var(--m3-on-danger-container);
    position: fixed;
    width: 100%;
    z-index: 99999;
}

.mobile-header {
    background-color: var(--m3-surface-container) !important;
    border-bottom: 1px solid rgba(120, 120, 120, 0.15) !important;

    .brand-link {
        color: var(--m3-on-surface) !important;
        font-weight: 600;
    }
}
</style>
