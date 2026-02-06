<template>
    <transition ref="tableContainer" name="slide-fade" appear>
        <div v-if="$route.name === 'DashboardHome'">
            <!-- Dashboard Stats Bar -->
            <div class="shadow-box big-padding mb-4 stats-bar">
                <div class="row">
                    <div class="col">
                        <h3>{{ $t("active") }}</h3>
                        <span class="num active">{{ activeNum }}</span>
                    </div>
                    <div class="col">
                        <h3>{{ $t("exited") }}</h3>
                        <span class="num exited">{{ exitedNum }}</span>
                    </div>
                    <div class="col">
                        <h3>{{ $t("inactive") }}</h3>
                        <span class="num inactive">{{ inactiveNum }}</span>
                    </div>
                    <div class="col">
                        <h3>{{ $t("totalCpu") }}</h3>
                        <span class="num cpu">{{ totalCpuUsage }}</span>
                    </div>
                    <div class="col">
                        <h3>{{ $t("totalMemory") }}</h3>
                        <span class="num memory">{{ totalMemUsage }}</span>
                    </div>
                </div>
            </div>

            <!-- Action Buttons Row -->
            <div class="d-flex align-items-center mb-4 gap-2">
                <router-link to="/compose" class="btn btn-primary">
                    <font-awesome-icon icon="plus" /> {{ $t("compose") }}
                </router-link>
                <button class="btn btn-normal" @click="showDockerRunModal = true">
                    <font-awesome-icon icon="terminal" /> {{ $t("Docker Run") }}
                </button>
                <div class="ms-auto">
                    <button class="btn btn-normal" @click="showAgentsPanel = true">
                        <font-awesome-icon icon="server" /> {{ $tc("dockgeAgent", 2) }}
                        <span class="badge bg-warning ms-1" style="font-size: 10px;">beta</span>
                    </button>
                </div>
            </div>

            <!-- Container Cards Grid -->
            <div v-if="groupedContainers && Object.keys(groupedContainers).length > 0" class="container-grid">
                <div v-for="(containers, stackName) in groupedContainers" :key="stackName" class="stack-group mb-4">
                    <div class="stack-header d-flex align-items-center mb-2">
                        <router-link v-if="stackExists(stackName)" :to="stackUrl(stackName)" class="stack-link">
                            <h4 class="mb-0">{{ stackName || 'standalone' }}</h4>
                        </router-link>
                        <h4 v-else class="mb-0">{{ stackName || 'standalone' }}</h4>

                        <!-- Stack-level action buttons -->
                        <div v-if="stackName && stackExists(stackName)" class="stack-actions ms-3">
                            <button
                                class="btn btn-sm btn-action"
                                :class="isStackRunning(stackName) ? 'btn-outline-danger' : 'btn-outline-success'"
                                :disabled="processingStacks[stackName]"
                                :title="isStackRunning(stackName) ? $t('stopStack') : $t('startStack')"
                                @click="isStackRunning(stackName) ? stopStack(stackName) : startStack(stackName)"
                            >
                                <font-awesome-icon :icon="isStackRunning(stackName) ? 'stop' : 'play'" size="sm" />
                            </button>
                            <button
                                class="btn btn-sm btn-action btn-outline-secondary"
                                :disabled="processingStacks[stackName] || !isStackRunning(stackName)"
                                :title="$t('restartStack')"
                                @click="restartStack(stackName)"
                            >
                                <font-awesome-icon icon="rotate" size="sm" />
                            </button>
                            <button
                                class="btn btn-sm btn-action btn-outline-primary"
                                :disabled="processingStacks[stackName]"
                                :title="$t('updateStack')"
                                @click="updateStack(stackName)"
                            >
                                <font-awesome-icon icon="cloud-arrow-down" size="sm" />
                            </button>
                        </div>
                    </div>

                    <div class="row g-3">
                        <div v-for="container in containers" :key="container.id" class="col-xl-4 col-lg-6 col-md-6">
                            <div class="shadow-box container-card" :class="{ 'container-running': container.state === 'running', 'container-exited': container.state === 'exited' }">
                                <!-- Container Header -->
                                <div class="container-header d-flex align-items-center mb-2">
                                    <span class="badge me-2" :class="containerBadgeClass(container.state)">{{ container.state }}</span>
                                    <strong class="container-name text-truncate">{{ container.name }}</strong>
                                </div>

                                <!-- Image -->
                                <div class="container-detail mb-1">
                                    <span class="detail-label">Image:</span>
                                    <span class="detail-value text-truncate" :title="container.image">{{ container.image }}</span>
                                </div>

                                <!-- Started / Uptime -->
                                <div class="container-detail mb-1">
                                    <span class="detail-label">
                                        <font-awesome-icon icon="clock" class="me-1" />
                                    </span>
                                    <span class="detail-value">{{ container.status }}</span>
                                </div>

                                <!-- Ports -->
                                <div v-if="containerPorts(container).length > 0" class="container-detail mb-1">
                                    <span class="detail-label">Ports:</span>
                                    <span class="detail-value">
                                        <a v-for="(port, idx) in containerPorts(container).slice(0, 3)" :key="idx" :href="port.url" target="_blank" class="badge bg-secondary me-1 port-badge">
                                            {{ port.display }}
                                        </a>
                                        <span v-if="containerPorts(container).length > 3" class="text-muted small">+{{ containerPorts(container).length - 3 }}</span>
                                    </span>
                                </div>

                                <!-- CPU & Memory -->
                                <div v-if="container.state === 'running'" class="container-stats mt-2">
                                    <div class="d-flex justify-content-between">
                                        <div class="stat-item">
                                            <font-awesome-icon icon="microchip" class="me-1" />
                                            <span>{{ container.cpuPercent || '0%' }}</span>
                                        </div>
                                        <div class="stat-item">
                                            <font-awesome-icon icon="memory" class="me-1" />
                                            <span>{{ container.memUsage || 'N/A' }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div v-else class="text-center mt-5">
                <p class="text-muted">{{ $t("noContainers") }}</p>
                <router-link to="/compose" class="btn btn-primary">
                    <font-awesome-icon icon="plus" /> {{ $t("compose") }}
                </router-link>
            </div>

            <!-- Docker Run Modal -->
            <BModal v-model="showDockerRunModal" :title="$t('Docker Run')" :okTitle="$t('Convert to Compose')" @ok="convertDockerRun" size="lg">
                <textarea
                    v-model="dockerRunCommand"
                    class="form-control docker-run"
                    rows="4"
                    :placeholder="$t('dockerRunPlaceholder')"
                ></textarea>
            </BModal>

            <!-- Docker Agents Slide-out Panel -->
            <transition name="slide-panel">
                <div v-if="showAgentsPanel" class="agents-overlay" @click.self="showAgentsPanel = false">
                    <div class="agents-panel shadow-box">
                        <div class="agents-panel-header d-flex align-items-center mb-3">
                            <h4 class="mb-0">{{ $tc("dockgeAgent", 2) }} <span class="badge bg-warning" style="font-size: 12px;">beta</span></h4>
                            <button class="btn btn-sm btn-normal ms-auto" @click="showAgentsPanel = false">
                                <font-awesome-icon icon="times" />
                            </button>
                        </div>

                        <div v-for="(agent, endpoint) in $root.agentList" :key="endpoint" class="mb-3 agent">
                            <template v-if="$root.agentStatusList[endpoint]">
                                <span v-if="$root.agentStatusList[endpoint] === 'online'" class="badge bg-primary me-2">{{ $t("agentOnline") }}</span>
                                <span v-else-if="$root.agentStatusList[endpoint] === 'offline'" class="badge bg-danger me-2">{{ $t("agentOffline") }}</span>
                                <span v-else class="badge bg-secondary me-2">{{ $t($root.agentStatusList[endpoint]) }}</span>
                            </template>

                            <span v-if="endpoint === ''">{{ $t("currentEndpoint") }}</span>
                            <a v-else :href="agent.url" target="_blank">{{ endpoint }}</a>

                            <font-awesome-icon v-if="endpoint !== ''" class="ms-2 remove-agent" icon="trash" @click="showRemoveAgentDialog[agent.url] = !showRemoveAgentDialog[agent.url]" />

                            <BModal v-model="showRemoveAgentDialog[agent.url]" :okTitle="$t('removeAgent')" okVariant="danger" @ok="removeAgent(agent.url)">
                                <p>{{ agent.url }}</p>
                                {{ $t("removeAgentMsg") }}
                            </BModal>
                        </div>

                        <button v-if="!showAgentForm" class="btn btn-normal" @click="showAgentForm = !showAgentForm">{{ $t("addAgent") }}</button>

                        <form v-if="showAgentForm" @submit.prevent="addAgent">
                            <div class="mb-3">
                                <label for="url" class="form-label">{{ $t("dockgeURL") }}</label>
                                <input id="url" v-model="agent.url" type="url" class="form-control" required placeholder="http://">
                            </div>
                            <div class="mb-3">
                                <label for="username" class="form-label">{{ $t("Username") }}</label>
                                <input id="username" v-model="agent.username" type="text" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label for="password" class="form-label">{{ $t("Password") }}</label>
                                <input id="password" v-model="agent.password" type="password" class="form-control" required autocomplete="new-password">
                            </div>
                            <button type="submit" class="btn btn-primary" :disabled="connectingAgent">
                                <template v-if="connectingAgent">{{ $t("connecting") }}</template>
                                <template v-else>{{ $t("connect") }}</template>
                            </button>
                        </form>
                    </div>
                </div>
            </transition>
        </div>
    </transition>
    <router-view ref="child" />
</template>

<script>
import { statusNameShort, RUNNING } from "../../../common/util-common";
import { BModal } from "bootstrap-vue-next";

export default {
    components: {
        BModal,
    },
    props: {
        calculatedHeight: {
            type: Number,
            default: 0
        }
    },
    data() {
        return {
            page: 1,
            perPage: 25,
            initialPerPage: 25,
            paginationConfig: {
                hideCount: true,
                chunksNavigation: "scroll",
            },
            importantHeartBeatListLength: 0,
            displayedRecords: [],
            dockerRunCommand: "",
            showAgentForm: false,
            showRemoveAgentDialog: {},
            connectingAgent: false,
            agent: {
                url: "http://",
                username: "",
                password: "",
            },
            showDockerRunModal: false,
            showAgentsPanel: false,
            containerStats: [],
            statsInterval: null,
            processingStacks: {},
        };
    },

    computed: {
        activeNum() {
            return this.getStatusNum("active");
        },
        inactiveNum() {
            return this.getStatusNum("inactive");
        },
        exitedNum() {
            return this.getStatusNum("exited");
        },
        totalCpuUsage() {
            if (!this.containerStats || this.containerStats.length === 0) {
                return "0%";
            }
            let total = 0;
            for (let c of this.containerStats) {
                if (c.cpuPercent) {
                    total += parseFloat(c.cpuPercent.replace("%", "")) || 0;
                }
            }
            return total.toFixed(1) + "%";
        },
        totalMemUsage() {
            if (!this.containerStats || this.containerStats.length === 0) {
                return "0 B";
            }
            let totalBytes = 0;
            for (let c of this.containerStats) {
                if (c.memUsage) {
                    let used = c.memUsage.split("/")[0].trim();
                    totalBytes += this.parseMemToBytes(used);
                }
            }
            return this.formatBytes(totalBytes);
        },
        groupedContainers() {
            let groups = {};
            if (!this.containerStats || this.containerStats.length === 0) {
                return groups;
            }
            for (let c of this.containerStats) {
                let stack = c.stackName || "standalone";
                if (!groups[stack]) {
                    groups[stack] = [];
                }
                groups[stack].push(c);
            }
            // Sort: running stacks first, then by name
            let sorted = {};
            let keys = Object.keys(groups).sort((a, b) => {
                let aRunning = groups[a].some(c => c.state === "running");
                let bRunning = groups[b].some(c => c.state === "running");
                if (aRunning && !bRunning) return -1;
                if (!aRunning && bRunning) return 1;
                return a.localeCompare(b);
            });
            for (let k of keys) {
                sorted[k] = groups[k];
            }
            return sorted;
        },
    },

    watch: {
        perPage() {
            this.$nextTick(() => {
                this.getImportantHeartbeatListPaged();
            });
        },

        page() {
            this.getImportantHeartbeatListPaged();
        },
    },

    mounted() {
        this.initialPerPage = this.perPage;
        this.fetchContainerStats();
        this.statsInterval = setInterval(() => {
            this.fetchContainerStats();
        }, 5000);
    },

    beforeUnmount() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
    },

    methods: {
        fetchContainerStats() {
            this.$root.emitAgent("", "allContainerStats", (res) => {
                if (res.ok) {
                    this.containerStats = res.containerStats;
                }
            });
        },

        parseMemToBytes(str) {
            if (!str) return 0;
            str = str.trim();
            let num = parseFloat(str);
            if (isNaN(num)) return 0;
            if (str.includes("GiB") || str.includes("GB")) return num * 1024 * 1024 * 1024;
            if (str.includes("MiB") || str.includes("MB")) return num * 1024 * 1024;
            if (str.includes("KiB") || str.includes("KB")) return num * 1024;
            if (str.includes("B")) return num;
            return num;
        },

        formatBytes(bytes) {
            if (bytes === 0) return "0 B";
            const units = ["B", "KB", "MB", "GB", "TB"];
            let i = 0;
            while (bytes >= 1024 && i < units.length - 1) {
                bytes /= 1024;
                i++;
            }
            return bytes.toFixed(1) + " " + units[i];
        },

        containerBadgeClass(state) {
            if (state === "running") return "bg-primary";
            if (state === "exited") return "bg-danger";
            return "bg-secondary";
        },

        containerPorts(container) {
            if (!container.ports) return [];
            let portStr = container.ports;
            let parts = portStr.split(",").map(s => s.trim()).filter(s => s.includes("->"));
            let hostname = this.$root.info.primaryHostname || location.hostname;
            return parts.map(p => {
                let hostPart = p.split("->")[0];
                // e.g. "0.0.0.0:8080" or ":::8080"
                let portNum = hostPart.split(":").pop();
                let port = parseInt(portNum);
                let protocol = (port === 443) ? "https" : "http";
                return {
                    url: protocol + "://" + hostname + ":" + port,
                    display: portNum,
                };
            });
        },

        stackExists(stackName) {
            for (let key in this.$root.completeStackList) {
                let stack = this.$root.completeStackList[key];
                if (stack.name === stackName) {
                    return true;
                }
            }
            return false;
        },

        stackUrl(stackName) {
            for (let key in this.$root.completeStackList) {
                let stack = this.$root.completeStackList[key];
                if (stack.name === stackName) {
                    if (stack.endpoint) {
                        return `/compose/${stack.name}/${stack.endpoint}`;
                    }
                    return `/compose/${stack.name}`;
                }
            }
            return `/compose/${stackName}`;
        },

        isStackRunning(stackName) {
            for (let key in this.$root.completeStackList) {
                let stack = this.$root.completeStackList[key];
                if (stack.name === stackName) {
                    return stack.status === RUNNING;
                }
            }
            return false;
        },

        getStackEndpoint(stackName) {
            for (let key in this.$root.completeStackList) {
                let stack = this.$root.completeStackList[key];
                if (stack.name === stackName) {
                    return stack.endpoint || "";
                }
            }
            return "";
        },

        startStack(stackName) {
            this.processingStacks[stackName] = true;
            let endpoint = this.getStackEndpoint(stackName);
            this.$root.emitAgent(endpoint, "startStack", stackName, (res) => {
                this.processingStacks[stackName] = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    setTimeout(() => this.fetchContainerStats(), 2000);
                }
            });
        },

        stopStack(stackName) {
            this.processingStacks[stackName] = true;
            let endpoint = this.getStackEndpoint(stackName);
            this.$root.emitAgent(endpoint, "stopStack", stackName, (res) => {
                this.processingStacks[stackName] = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    setTimeout(() => this.fetchContainerStats(), 2000);
                }
            });
        },

        restartStack(stackName) {
            this.processingStacks[stackName] = true;
            let endpoint = this.getStackEndpoint(stackName);
            this.$root.emitAgent(endpoint, "restartStack", stackName, (res) => {
                this.processingStacks[stackName] = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    setTimeout(() => this.fetchContainerStats(), 2000);
                }
            });
        },

        updateStack(stackName) {
            this.processingStacks[stackName] = true;
            let endpoint = this.getStackEndpoint(stackName);
            this.$root.emitAgent(endpoint, "updateStack", stackName, (res) => {
                this.processingStacks[stackName] = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    setTimeout(() => this.fetchContainerStats(), 2000);
                }
            });
        },

        addAgent() {
            this.connectingAgent = true;
            this.$root.getSocket().emit("addAgent", this.agent, (res) => {
                this.$root.toastRes(res);

                if (res.ok) {
                    this.showAgentForm = false;
                    this.agent = {
                        url: "http://",
                        username: "",
                        password: "",
                    };
                }

                this.connectingAgent = false;
            });
        },

        removeAgent(url) {
            this.$root.getSocket().emit("removeAgent", url, (res) => {
                if (res.ok) {
                    this.$root.toastRes(res);

                    let urlObj = new URL(url);
                    let endpoint = urlObj.host;

                    delete this.$root.allAgentStackList[endpoint];
                }
            });
        },

        getStatusNum(statusName) {
            let num = 0;

            for (let stackName in this.$root.completeStackList) {
                const stack = this.$root.completeStackList[stackName];
                if (statusNameShort(stack.status) === statusName) {
                    num += 1;
                }
            }
            return num;
        },

        convertDockerRun() {
            if (this.dockerRunCommand.trim() === "" || this.dockerRunCommand.trim() === "docker run") {
                this.$root.toastError("Please enter a docker run command");
                return;
            }

            this.$root.getSocket().emit("composerize", this.dockerRunCommand, (res) => {
                if (res.ok) {
                    this.$root.composeTemplate = res.composeTemplate;
                    this.showDockerRunModal = false;
                    this.$router.push("/compose");
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        onNewImportantHeartbeat(heartbeat) {
            if (this.page === 1) {
                this.displayedRecords.unshift(heartbeat);
                if (this.displayedRecords.length > this.perPage) {
                    this.displayedRecords.pop();
                }
                this.importantHeartBeatListLength += 1;
            }
        },

        getImportantHeartbeatListLength() {
            this.$root.getSocket().emit("monitorImportantHeartbeatListCount", null, (res) => {
                if (res.ok) {
                    this.importantHeartBeatListLength = res.count;
                    this.getImportantHeartbeatListPaged();
                }
            });
        },

        getImportantHeartbeatListPaged() {
            const offset = (this.page - 1) * this.perPage;
            this.$root.getSocket().emit("monitorImportantHeartbeatListPaged", null, offset, this.perPage, (res) => {
                if (res.ok) {
                    this.displayedRecords = res.data;
                }
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../styles/vars";

.stats-bar {
    padding: 20px;
    text-align: center;

    h3 {
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #6c757d;
        margin-bottom: 4px;
    }
}

.num {
    font-size: 28px;
    font-weight: bold;
    display: block;

    &.active {
        color: $primary;
    }

    &.exited {
        color: $danger;
    }

    &.cpu {
        color: $warning;
    }

    &.memory {
        color: #6f42c1;
    }
}

.container-card {
    padding: 15px;
    transition: all 0.2s ease;
    border-left: 3px solid transparent;
    height: 100%;

    &.container-running {
        border-left-color: $primary;
    }

    &.container-exited {
        border-left-color: $danger;
        opacity: 0.8;
    }

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }
}

.container-header {
    .container-name {
        font-size: 14px;
        max-width: calc(100% - 80px);
        display: inline-block;
    }
}

.container-detail {
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;

    .detail-label {
        color: #6c757d;
        flex-shrink: 0;
    }

    .detail-value {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.container-stats {
    font-size: 12px;
    padding-top: 8px;
    border-top: 1px solid #eee;

    .stat-item {
        color: #6c757d;
    }

    .dark & {
        border-top-color: $dark-border-color;
    }
}

.port-badge {
    font-size: 11px;
    text-decoration: none;
    cursor: pointer;

    &:hover {
        opacity: 0.8;
    }
}

.stack-header {
    h4 {
        font-size: 18px;
        margin-bottom: 0;
    }
}

.stack-link {
    text-decoration: none;
    color: inherit;

    &:hover h4 {
        color: $primary;
    }
}

.stack-actions {
    display: flex;
    gap: 4px;
}

.btn-action {
    width: 30px;
    height: 30px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
}

.docker-run {
    border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
}

/* Agents slide-out panel */
.agents-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.3);
    z-index: 1050;
    backdrop-filter: blur(2px);
}

.agents-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 400px;
    max-width: 90vw;
    padding: 20px;
    overflow-y: auto;
    z-index: 1051;
    background-color: white;
    border-radius: 0;
    box-shadow: -5px 0 30px rgba(0, 0, 0, 0.2);

    .dark & {
        background-color: $dark-bg;
    }
}

.slide-panel-enter-active,
.slide-panel-leave-active {
    transition: all 0.3s ease;
}

.slide-panel-enter-from .agents-panel,
.slide-panel-leave-to .agents-panel {
    transform: translateX(100%);
}

.slide-panel-enter-from,
.slide-panel-leave-to {
    opacity: 0;
}

.remove-agent {
    cursor: pointer;
    color: rgba(255, 255, 255, 0.3);
}

.agent {
    a {
        text-decoration: none;
    }
}

.shadow-box {
    padding: 10px;
}

</style>
