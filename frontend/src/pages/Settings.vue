<template>
    <div>
        <h1 v-show="show" class="mb-3">
            {{ $t("Settings") }}
        </h1>

        <div class="shadow-box shadow-box-settings">
            <div class="row">
                <div v-if="showSubMenu" class="settings-menu col-lg-3 col-md-5 col-12">
                    <router-link
                        v-for="(item, key) in subMenus"
                        :key="key"
                        :to="`/settings/${key}`"
                    >
                        <div class="menu-item">
                            {{ item.title }}
                        </div>
                    </router-link>

                    <!-- Logout Action -->
                    <a v-if="$root.loggedIn" href="#" class="text-decoration-none logout" @click.prevent="$root.logout">
                        <div class="menu-item">
                            <font-awesome-icon icon="sign-out-alt" class="me-2" />
                            {{ $t("Logout") }}
                        </div>
                    </a>
                </div>
                <div v-if="!isMobile || currentPage" class="settings-content col-lg-9 col-md-7 col-12">
                    <div v-if="currentPage" class="settings-content-header">
                        <router-link v-if="isMobile" to="/settings" class="btn btn-outline-normal btn-sm me-2">
                            <font-awesome-icon icon="chevron-left" />
                        </router-link>
                        {{ subMenus[currentPage].title }}
                    </div>
                    <div class="mx-3">
                        <router-view v-slot="{ Component }">
                            <transition name="slide-fade" appear>
                                <component :is="Component" />
                            </transition>
                        </router-view>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            show: true,
            settings: {},
            settingsLoaded: false,
            windowWidth: window.innerWidth,
        };
    },

    computed: {
        currentPage() {
            let pathSplit = this.$route.path.split("/");
            let pathEnd = pathSplit[pathSplit.length - 1];
            if (!pathEnd || pathEnd === "settings") {
                return null;
            }
            return pathEnd;
        },

        isMobile() {
            return this.windowWidth < 768;
        },

        showSubMenu() {
            if (this.isMobile) {
                return !this.currentPage;
            } else {
                return true;
            }
        },

        subMenus() {
            return {
                general: {
                    title: this.$t("general"),
                },
                security: {
                    title: this.$t("Security"),
                },
                scanner: {
                    title: this.$t("Vulnerability Scanner"),
                },
                about: {
                    title: this.$t("About"),
                },
            };
        },
    },

    watch: {
        isMobile() {
            this.loadGeneralPage();
        }
    },

    mounted() {
        window.addEventListener("resize", this.onResize);
        this.loadSettings();
        this.loadGeneralPage();
    },

    beforeUnmount() {
        window.removeEventListener("resize", this.onResize);
    },

    methods: {
        onResize() {
            this.windowWidth = window.innerWidth;
        },

        /**
         * Load the general settings page
         * For desktop only, on mobile do nothing
         */
        loadGeneralPage() {
            if (!this.currentPage && !this.isMobile) {
                this.$router.push("/settings/general");
            }
        },

        /** Load settings from server */
        loadSettings() {
            this.$root.getSocket().emit("getSettings", (res) => {
                this.settings = res.data;
                if (this.settings.checkUpdate === undefined) {
                    this.settings.checkUpdate = true;
                }
                this.settingsLoaded = true;
            });
        },

        /**
         * Save Settings
         * @param {Function} [callback]
         * @param {string} [currentPassword] Only need for disableAuth to true
         */
        saveSettings(callback, currentPassword) {
            let valid = this.validateSettings();
            if (valid.success) {
                this.$root.getSocket().emit("setSettings", this.settings, currentPassword, (res) => {
                    this.$root.toastRes(res);
                    this.loadSettings();

                    if (callback) {
                        callback();
                    }
                });
            } else {
                this.$root.toastError(valid.msg);
            }
        },

        /**
         * Ensure settings are valid
         * @returns {Object} Contains success state and error msg
         */
        validateSettings() {
            if (this.settings.keepDataPeriodDays < 0) {
                return {
                    success: false,
                    msg: this.$t("dataRetentionTimeError"),
                };
            }
            return {
                success: true,
                msg: "",
            };
        },
    }
};
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.shadow-box-settings {
    padding: 24px;
    background-color: var(--m3-surface-container) !important;
    border: 1px solid rgba(120, 120, 120, 0.15) !important;
    border-radius: var(--m3-card-radius) !important;
    min-height: calc(100vh - 120px);

    @media (max-width: 767.98px) {
        padding: 16px !important;
        margin: -15px -15px 0 -15px !important;
        border-radius: 0 !important;
        border: none !important;
        background-color: transparent !important;
        min-height: calc(100vh - 100px);
    }
}

footer {
    color: #aaa;
    font-size: 13px;
    margin-top: 20px;
    padding-bottom: 30px;
    text-align: center;
}

.settings-menu {
    a {
        text-decoration: none !important;
    }

    .menu-item {
        border-radius: var(--m3-button-radius) !important;
        margin: 4px 8px !important;
        padding: 10px 16px !important;
        cursor: pointer;
        transition: all 0.2s ease;
        color: var(--m3-on-surface-variant);
        font-weight: 500;
        font-size: 14px;
    }

    .menu-item:hover {
        background-color: rgba(120, 120, 120, 0.08) !important;
        color: var(--m3-on-surface);
    }

    .active .menu-item {
        background-color: var(--m3-primary-container) !important;
        color: var(--m3-on-primary-container) !important;
        border-left: none !important;
        font-weight: 600;
    }
}

.settings-content {
    .settings-content-header {
        width: 100%;
        border-bottom: 1px solid rgba(120, 120, 120, 0.15) !important;
        margin-top: 0;
        margin-right: 0;
        padding-bottom: 12px;
        margin-bottom: 20px;
        font-size: 22px;
        font-weight: 600;
        color: var(--m3-on-surface);
        background: transparent !important;

        @media (max-width: 767.98px) {
            padding: 15px 0 0 0;
            background-color: transparent;
        }
    }
}

.logout {
    color: #ef4444 !important;
}
</style>
