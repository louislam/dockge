<template>
    <transition name="slide-fade" appear>
        <div
            class="container-details-page"
            :class="{ 'logs-active': activeTab === 'logs' }"
            :style="containerDetailsStyle"
        >
            <nav class="detail-breadcrumb mb-2" aria-label="breadcrumb">
                <router-link :to="stackRoute">{{ stackName }}</router-link>
                <span>/</span>
                <span>{{ serviceName || $tc("container", 1) }}</span>
                <span>/</span>
                <span>{{ containerName }}</span>
            </nav>

            <div class="detail-header mb-3">
                <div>
                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <h1 class="mb-0">{{ containerName }}</h1>
                        <span v-if="container" class="badge" :class="statusClass">{{ container.status }}</span>
                    </div>
                    <div v-if="serviceName" class="service-name mt-1">{{ $t("service") }}: {{ serviceName }}</div>
                </div>

                <div v-if="container" class="action-bar btn-group" role="group">
                    <button v-if="!isRunning" class="btn btn-primary" :disabled="processing" @click="performAction('startContainer')">
                        <font-awesome-icon icon="play" class="me-1" /> {{ $t("startStack") }}
                    </button>
                    <button v-if="isRunning" class="btn btn-normal" :disabled="processing" @click="performAction('restartContainer')">
                        <font-awesome-icon icon="rotate" class="me-1" /> {{ $t("restartStack") }}
                    </button>
                    <button v-if="isRunning" class="btn btn-normal" :disabled="processing" @click="performAction('stopContainer')">
                        <font-awesome-icon icon="stop" class="me-1" /> {{ $t("stopStack") }}
                    </button>
                </div>
            </div>

            <div v-if="!loaded" class="shadow-box big-padding">{{ $t("loadingContainer") }}</div>
            <div v-else-if="!container" class="shadow-box big-padding empty-state">
                <h4>{{ $t("containerNotFound") }}</h4>
                <p class="mb-3">{{ $t("containerNotFoundDescription") }}</p>
                <router-link class="btn btn-primary" :to="stackRoute">{{ $t("backToStack") }}</router-link>
            </div>

            <template v-else>
                <div class="tabs-scroll mb-3">
                    <ul class="nav detail-tabs flex-nowrap" role="tablist">
                        <li class="nav-item">
                            <button
                                class="nav-link"
                                :class="{ active: activeTab === 'overview' }"
                                role="tab"
                                :aria-selected="activeTab === 'overview'"
                                @click="setTab('overview')"
                            >
                                {{ $t("overview") }}
                            </button>
                        </li>
                        <li class="nav-item">
                            <button
                                class="nav-link"
                                :class="{ active: activeTab === 'logs' }"
                                role="tab"
                                :aria-selected="activeTab === 'logs'"
                                @click="setTab('logs')"
                            >
                                {{ $t("logs") }}
                            </button>
                        </li>
                        <li class="nav-item">
                            <button
                                class="nav-link"
                                :class="{ active: activeTab === 'terminal' }"
                                role="tab"
                                :aria-selected="activeTab === 'terminal'"
                                @click="setTab('terminal')"
                            >
                                {{ $t("terminal") }}
                            </button>
                        </li>
                    </ul>
                </div>

                <section v-if="activeTab === 'overview'" class="overview-grid">
                    <article class="detail-card shadow-box">
                        <div class="detail-label">{{ $t("status") }}</div>
                        <div class="detail-value">{{ container.state || container.status }}</div>
                    </article>
                    <article class="detail-card shadow-box">
                        <div class="detail-label">{{ $t("health") }}</div>
                        <div class="detail-value">{{ container.health || $t("notAvailableShort") }}</div>
                    </article>
                    <article class="detail-card shadow-box image-card">
                        <div class="detail-label">{{ $t("dockerImage") }}</div>
                        <div class="detail-value text-break">{{ container.image || $t("notAvailableShort") }}</div>
                    </article>
                    <article class="detail-card shadow-box">
                        <div class="detail-label">{{ $tc("port", 2) }}</div>
                        <div class="detail-value text-break">{{ container.ports || $t("notAvailableShort") }}</div>
                    </article>
                    <article class="detail-card shadow-box">
                        <div class="detail-label">{{ $t("createdAt") }}</div>
                        <div class="detail-value">{{ container.createdAt || $t("notAvailableShort") }}</div>
                    </article>
                    <article class="detail-card shadow-box">
                        <div class="detail-label">{{ $t("runningFor") }}</div>
                        <div class="detail-value">{{ container.runningFor || $t("notAvailableShort") }}</div>
                    </article>
                    <article class="detail-card shadow-box">
                        <div class="detail-label">{{ $t("CPU") }}</div>
                        <div class="detail-value">{{ containerStats?.CPUPerc || $t("notAvailableShort") }}</div>
                    </article>
                    <article class="detail-card shadow-box">
                        <div class="detail-label">{{ $t("memory") }}</div>
                        <div class="detail-value">{{ containerStats?.MemUsage || $t("notAvailableShort") }}</div>
                    </article>
                </section>

                <section v-if="activeTab === 'logs'" class="log-panel" :class="{ fullscreen: logFullscreen }">
                    <div class="log-toolbar">
                        <button class="btn btn-sm btn-normal" :class="{ active: followLogs }" @click="toggleFollow">
                            <font-awesome-icon :icon="followLogs ? 'pause' : 'play'" class="me-1" />
                            {{ followLogs ? $t("pauseFollow") : $t("resumeFollow") }}
                        </button>
                        <button class="btn btn-sm btn-normal" @click="clearLogs">
                            <font-awesome-icon icon="trash" class="me-1" /> {{ $t("clearDisplay") }}
                        </button>
                        <button class="btn btn-sm btn-normal" :disabled="!hasLogSelection" @click="copyLogs">
                            <font-awesome-icon icon="copy" class="me-1" /> {{ $t("copySelection") }}
                        </button>
                        <button class="btn btn-sm btn-normal ms-auto" @click="toggleFullscreen">
                            <font-awesome-icon :icon="logFullscreen ? 'compress' : 'expand'" class="me-1" />
                            {{ logFullscreen ? $t("exitFullscreen") : $t("fullscreen") }}
                        </button>
                    </div>
                    <div class="log-body">
                        <Terminal
                            ref="logTerminal"
                            class="container-log-terminal terminal"
                            :name="logTerminalName"
                            :endpoint="endpoint"
                            :auto-follow="true"
                            :show-toolbar="false"
                            @ready="joinLogs"
                            @follow-change="followLogs = $event"
                            @selection-change="hasLogSelection = $event"
                        />
                    </div>
                </section>

                <section v-if="activeTab === 'terminal'">
                    <div v-if="!isRunning" class="shadow-box big-padding empty-state">
                        {{ $t("terminalRequiresRunningContainer") }}
                    </div>
                    <template v-else>
                        <div class="d-flex align-items-center gap-2 mb-3">
                            <span>{{ $t("shell") }}:</span>
                            <div class="btn-group" role="group">
                                <button class="btn btn-sm" :class="shell === 'bash' ? 'btn-primary' : 'btn-normal'" @click="shell = 'bash'">bash</button>
                                <button class="btn btn-sm" :class="shell === 'sh' ? 'btn-primary' : 'btn-normal'" @click="shell = 'sh'">sh</button>
                            </div>
                        </div>
                        <Terminal
                            :key="shell"
                            class="instance-terminal terminal"
                            :name="instanceTerminalName"
                            :endpoint="endpoint"
                            :stack-name="stackName"
                            :container-name="containerName"
                            :shell="shell"
                            mode="interactiveContainer"
                            :rows="24"
                        />
                    </template>
                </section>
            </template>
        </div>
    </transition>
</template>

<script>
import {
    getContainerInstanceExecTerminalName,
    getContainerLogTerminalName
} from "../../../common/util-common";

export default {
    data() {
        return {
            activeTab: "overview",
            containerStatusList: {},
            dockerStats: {},
            loaded: false,
            processing: false,
            pollInterval: null,
            shell: "bash",
            logJoined: false,
            logFullscreen: false,
            followLogs: true,
            hasLogSelection: false,
            availablePageHeight: 0,
        };
    },
    computed: {
        stackName() {
            return this.$route.params.stackName;
        },
        containerName() {
            return this.$route.params.containerName;
        },
        endpoint() {
            return this.$route.params.endpoint || "";
        },
        container() {
            for (const containers of Object.values(this.containerStatusList)) {
                const container = containers.find(item => item.name === this.containerName);
                if (container) {
                    return container;
                }
            }
            return null;
        },
        serviceName() {
            return this.container?.service || "";
        },
        containerStats() {
            return this.dockerStats[this.containerName] || null;
        },
        isRunning() {
            return this.container?.state === "running";
        },
        statusClass() {
            if (this.container?.health === "unhealthy") {
                return "bg-danger";
            }
            return this.isRunning ? "bg-primary" : "bg-secondary";
        },
        stackRoute() {
            return this.endpoint ? `/compose/${this.stackName}/${this.endpoint}` : `/compose/${this.stackName}`;
        },
        logTerminalName() {
            return getContainerLogTerminalName(this.endpoint, this.stackName, this.containerName);
        },
        instanceTerminalName() {
            return getContainerInstanceExecTerminalName(this.endpoint, this.stackName, this.containerName, this.shell);
        },
        containerDetailsStyle() {
            if (!this.availablePageHeight) {
                return {};
            }
            return {
                "--container-details-height": `${this.availablePageHeight}px`,
            };
        },
    },
    created() {
        const requestedTab = this.$route.query.tab;
        if ([ "overview", "logs", "terminal" ].includes(requestedTab)) {
            this.activeTab = requestedTab;
        }
    },
    mounted() {
        this.updateAvailableHeight();
        window.addEventListener("resize", this.updateAvailableHeight);
        this.refresh();
        this.pollInterval = window.setInterval(this.refresh, 5000);
    },
    unmounted() {
        window.clearInterval(this.pollInterval);
        window.removeEventListener("resize", this.updateAvailableHeight);
        this.leaveLogs();
    },
    methods: {
        refresh() {
            this.$root.emitAgent(this.endpoint, "serviceStatusList", this.stackName, (res) => {
                if (res.ok) {
                    this.containerStatusList = res.serviceStatusList;
                } else {
                    this.$root.toastRes(res);
                }
                this.loaded = true;
            });
            this.$root.emitAgent(this.endpoint, "dockerStats", (res) => {
                if (res.ok) {
                    this.dockerStats = res.dockerStats;
                }
            });
        },
        setTab(tab) {
            if (this.activeTab === "logs" && tab !== "logs") {
                this.leaveLogs();
                this.logFullscreen = false;
            }
            this.activeTab = tab;
            this.$nextTick(this.updateAvailableHeight);
        },
        /**
         * Fill the viewport below the page's current top edge without making the document scroll.
         */
        updateAvailableHeight() {
            let pageTop = 0;
            let element = this.$el;
            while (element) {
                pageTop += element.offsetTop;
                element = element.offsetParent;
            }
            pageTop -= window.scrollY;
            this.availablePageHeight = Math.max(0, window.innerHeight - pageTop - 16);
            if (this.activeTab === "logs") {
                this.$nextTick(() => this.$refs.logTerminal?.fit());
            }
        },
        performAction(eventName) {
            this.processing = true;
            this.$root.emitAgent(this.endpoint, eventName, this.stackName, this.containerName, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.refresh();
                }
            });
        },
        joinLogs() {
            if (this.logJoined) {
                return;
            }
            this.$root.emitAgent(this.endpoint, "joinContainerLogs", this.stackName, this.containerName, (res) => {
                if (res.ok) {
                    this.logJoined = true;
                    this.$nextTick(() => this.$refs.logTerminal?.fit());
                } else {
                    this.$root.toastRes(res);
                }
            });
        },
        leaveLogs() {
            if (!this.logJoined) {
                return;
            }
            this.logJoined = false;
            this.$root.emitAgent(this.endpoint, "leaveContainerLogs", this.stackName, this.containerName, () => {});
        },
        toggleFollow() {
            this.$refs.logTerminal?.setFollow(!this.followLogs);
        },
        clearLogs() {
            this.$refs.logTerminal?.clear();
        },
        copyLogs() {
            this.$refs.logTerminal?.copySelection();
        },
        toggleFullscreen() {
            this.logFullscreen = !this.logFullscreen;
            this.$nextTick(() => this.$refs.logTerminal?.fit());
        },
    },
};
</script>

<style scoped lang="scss">
@import "../styles/vars.scss";

.detail-breadcrumb {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    color: $dark-font-color;
    font-size: 0.9rem;
}

.container-details-page.logs-active {
    display: flex;
    overflow: hidden;
    flex-direction: column;
    height: var(--container-details-height, calc(100dvh - 7rem));
    min-height: 0;
}

.logs-active > .detail-breadcrumb,
.logs-active > .detail-header,
.logs-active > .tabs-scroll {
    flex: 0 0 auto;
}

.detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}

.service-name,
.detail-label {
    color: $dark-font-color;
}

.tabs-scroll {
    overflow-x: auto;
}

.detail-tabs {
    gap: 0.25rem;
    min-width: max-content;
    padding: 0.25rem;
    border: 1px solid rgba(127, 127, 127, 0.16);
    border-radius: 0.75rem;
    background: rgba(127, 127, 127, 0.08);
}

.detail-tabs .nav-link {
    padding: 0.5rem 0.9rem;
    border: 0;
    border-radius: 0.55rem;
    color: $dark-font-color;
    background: transparent;
    transition: color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.detail-tabs .nav-link:hover:not(.active) {
    color: $primary;
    background: rgba(116, 194, 255, 0.08);
}

.detail-tabs .nav-link.active {
    color: $dark-font-color2;
    background: $primary-gradient;
    box-shadow: 0 4px 16px rgba(116, 194, 255, 0.18);
    font-weight: 600;
}

.overview-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
}

.detail-card {
    min-width: 0;
    padding: 1.25rem;
}

.image-card {
    grid-column: span 2;
}

.detail-label {
    margin-bottom: 0.4rem;
    font-size: 0.8rem;
    text-transform: uppercase;
}

.detail-value {
    font-size: 1rem;
    font-weight: 600;
}

.log-panel {
    overflow: hidden;
    border-radius: 0.75rem;
    background: #000;
}

.logs-active .log-panel:not(.fullscreen) {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    min-height: 0;
}

.log-toolbar {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.65rem;
    background: $dark-header-bg;
}

.log-toolbar .active {
    color: #000;
    background: $primary-gradient;
}

.log-body {
    height: clamp(480px, calc(100vh - 270px), 900px);
}

.logs-active .log-panel:not(.fullscreen) .log-body {
    overflow: hidden;
    flex: 1 1 auto;
    height: auto;
    min-height: 0;
}

.container-log-terminal,
.instance-terminal {
    height: 100%;
    margin-bottom: 0 !important;
    border-radius: 0;
}

.instance-terminal {
    min-height: 520px;
}

.log-panel.fullscreen {
    position: fixed;
    z-index: 2000;
    inset: 0;
    border-radius: 0;
}

.log-panel.fullscreen .log-body {
    height: calc(100dvh - 58px);
}

.empty-state {
    color: $dark-font-color;
}

@media (max-width: 767.98px) {
    .detail-header {
        align-items: stretch;
        flex-direction: column;
    }

    .action-bar {
        display: flex;
        width: 100%;
    }

    .action-bar .btn {
        flex: 1;
    }

    .overview-grid {
        grid-template-columns: 1fr;
    }

    .image-card {
        grid-column: span 1;
    }

    .log-body {
        height: calc(100dvh - 290px);
        min-height: 360px;
    }

    .log-toolbar .ms-auto {
        margin-left: 0 !important;
    }
}
</style>
