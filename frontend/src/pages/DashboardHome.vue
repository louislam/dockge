<template>
    <transition ref="tableContainer" name="slide-fade" appear>
        <div v-if="$route.name === 'DashboardHome'">
            <h1 class="mb-3">
                {{ $t("home") }}
            </h1>

            <div class="row first-row">
                <!-- Left -->
                <div class="col-md-7">
                    <!-- Stats Grid -->
                    <div class="row mb-4 g-3">
                        <div class="col-4">
                            <div class="shadow-box text-center stat-card active-card py-2">
                                <span class="stat-label d-block mb-1">{{ $t("active") }}</span>
                                <span class="num active font-semibold">{{ activeNum }}</span>
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="shadow-box text-center stat-card exited-card py-2">
                                <span class="stat-label d-block mb-1">{{ $t("exited") }}</span>
                                <span class="num exited font-semibold">{{ exitedNum }}</span>
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="shadow-box text-center stat-card inactive-card py-2">
                                <span class="stat-label d-block mb-1">{{ $t("inactive") }}</span>
                                <span class="num inactive font-semibold">{{ inactiveNum }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Server System Info -->
                    <h2 class="mb-3 mt-4">{{ $t("System Resource Usage") }}</h2>
                    <div class="shadow-box stat-card mb-4 p-4" style="background-color: var(--m3-surface-container); border: 1px solid rgba(120, 120, 120, 0.15) !important;">
                        <div class="mb-3">
                            <div class="d-flex justify-content-between mb-1">
                                <span>CPU Usage</span>
                                <span class="font-semibold">{{ serverStats.cpu }}%</span>
                            </div>
                            <div class="progress" style="height: 8px; border-radius: 4px; background-color: var(--m3-surface-container-high);">
                                <div class="progress-bar bg-primary" role="progressbar" :style="{ width: serverStats.cpu + '%' }"></div>
                            </div>
                        </div>

                        <div class="mb-3">
                            <div class="d-flex justify-content-between mb-1">
                                <span>RAM Usage</span>
                                <span class="font-semibold">{{ serverStats.ram.used }} / {{ serverStats.ram.total }} ({{ serverStats.ram.percent }}%)</span>
                            </div>
                            <div class="progress" style="height: 8px; border-radius: 4px; background-color: var(--m3-surface-container-high);">
                                <div class="progress-bar bg-success" role="progressbar" :style="{ width: serverStats.ram.percent + '%' }"></div>
                            </div>
                        </div>

                        <div>
                            <div class="d-flex justify-content-between mb-1">
                                <span>Storage Usage</span>
                                <span class="font-semibold">{{ serverStats.storage.used }} / {{ serverStats.storage.total }} ({{ serverStats.storage.percent }}%)</span>
                            </div>
                            <div class="progress" style="height: 8px; border-radius: 4px; background-color: var(--m3-surface-container-high);">
                                <div class="progress-bar bg-warning" role="progressbar" :style="{ width: serverStats.storage.percent + '%' }"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Network & IP Info -->
                    <h2 class="mb-3 mt-4">{{ $t("Network & IP Addresses") }}</h2>
                    <div class="shadow-box stat-card mb-4 p-4" style="background-color: var(--m3-surface-container); border: 1px solid rgba(120, 120, 120, 0.15) !important;">
                        <div v-if="serverStats.network && serverStats.network.length > 0">
                            <div v-for="net in serverStats.network" :key="net.address" class="d-flex justify-content-between align-items-center mb-2 py-1 border-bottom border-secondary border-opacity-10">
                                <span class="badge bg-secondary" style="font-size: 11px;">{{ net.name }}</span>
                                <span class="font-monospace text-primary fw-semibold">{{ net.address }}</span>
                            </div>
                        </div>
                        <div v-else class="text-secondary text-center">
                            No network interfaces detected
                        </div>

                        <!-- Network Speed & Diagnostics -->
                        <div class="row mt-4 pt-3 border-top border-secondary border-opacity-20 g-2">
                            <div class="col-6">
                                <span class="text-secondary small d-block">Incoming (RX)</span>
                                <span class="font-monospace fw-bold text-success">{{ serverStats.networkSpeed?.rx || '0 B/s' }}</span>
                            </div>
                            <div class="col-6">
                                <span class="text-secondary small d-block">Outgoing (TX)</span>
                                <span class="font-monospace fw-bold text-info">{{ serverStats.networkSpeed?.tx || '0 B/s' }}</span>
                            </div>
                            <div class="col-6 mt-2">
                                <span class="text-secondary small d-block">Primary DNS</span>
                                <span class="font-monospace text-warning fw-semibold text-truncate d-block" style="font-size: 13px;">{{ serverStats.dns || 'N/A' }}</span>
                            </div>
                            <div class="col-6 mt-2">
                                <span class="text-secondary small d-block">Ping Latency</span>
                                <span class="font-monospace text-primary fw-bold">{{ serverStats.ping || 'N/A' }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- System Details Info -->
                    <h2 class="mb-3 mt-4">{{ $t("System Information") }}</h2>
                    <div class="shadow-box stat-card mb-4 p-4" style="background-color: var(--m3-surface-container); border: 1px solid rgba(120, 120, 120, 0.15) !important;">
                        <div class="row g-3">
                            <div class="col-6">
                                <span class="text-secondary small d-block">OS Type</span>
                                <span class="fw-semibold">{{ serverStats.system?.os || 'N/A' }}</span>
                            </div>
                            <div class="col-6">
                                <span class="text-secondary small d-block">Kernel Version</span>
                                <span class="fw-semibold text-truncate d-block" style="font-size: 13px;" :title="serverStats.system?.osVersion">{{ serverStats.system?.osVersion || 'N/A' }}</span>
                            </div>
                            <div class="col-6">
                                <span class="text-secondary small d-block">Architecture</span>
                                <span class="fw-semibold">{{ serverStats.system?.arch || 'N/A' }}</span>
                            </div>
                            <div class="col-6">
                                <span class="text-secondary small d-block">Docker Version</span>
                                <span class="fw-semibold text-primary font-monospace">{{ serverStats.system?.dockerVersion || 'N/A' }}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Right -->
                <div class="col-md-5">
                    <!-- Agent List -->
                    <div class="shadow-box big-padding">
                        <h4 class="mb-3">{{ $tc("dockgeAgent", 2) }} <span class="badge bg-warning" style="font-size: 12px;">beta</span></h4>

                        <div v-for="(agentItem, endpoint) in $root.agentList" :key="endpoint" class="mb-3 agent">
                            <!-- Agent Status -->
                            <template v-if="$root.agentStatusList[endpoint]">
                                <span v-if="$root.agentStatusList[endpoint] === 'online'" class="badge bg-primary me-2">{{ $t("agentOnline") }}</span>
                                <span v-else-if="$root.agentStatusList[endpoint] === 'offline'" class="badge bg-danger me-2">{{ $t("agentOffline") }}</span>
                                <span v-else class="badge bg-secondary me-2">{{ $t($root.agentStatusList[endpoint]) }}</span>
                            </template>

                            <!-- Agent Display Name -->
                            <template v-if="$root.agentStatusList[endpoint]">
                                <span v-if="endpoint === '' && agentItem.name === ''" class="badge bg-secondary me-2">Current</span>
                                <span v-else-if="agentItem.name === ''" :href="agentItem.url" class="me-2">{{ endpoint }}</span>
                                <span v-else :href="agentItem.url" class="me-2">{{ agentItem.name }}</span>
                            </template>

                            <!-- Edit Name  -->
                            <font-awesome-icon v-if="agentItem.name !== ''" icon="pen-to-square" @click="showEditAgentNameDialog[agentItem.name] = !showEditAgentNameDialog[agentItem.Name]" />

                            <!-- Edit Dialog -->
                            <BModal v-model="showEditAgentNameDialog[agentItem.name]" :no-close-on-backdrop="true" :close-on-esc="true" :okTitle="$t('Update Name')" okVariant="info" @ok="updateName(agentItem.url, agentItem.updatedName)">
                                <label for="Update Name" class="form-label">Current value: {{ $t(agentItem.name) }}</label>
                                <input id="updatedName" v-model="agentItem.updatedName" type="text" class="form-control" optional>
                            </BModal>

                            <!-- Remove Button -->
                            <font-awesome-icon v-if="endpoint !== ''" class="ms-2 remove-agent" icon="trash" @click="showRemoveAgentDialog[agentItem.url] = !showRemoveAgentDialog[agentItem.url]" />

                            <!-- Remove Agent Dialog -->
                            <BModal v-model="showRemoveAgentDialog[agentItem.url]" :okTitle="$t('removeAgent')" okVariant="danger" @ok="removeAgent(agentItem.url)">
                                <p>{{ agentItem.url }}</p>
                                {{ $t("removeAgentMsg") }}
                            </BModal>
                        </div>

                        <button v-if="!showAgentForm" class="btn btn-normal" @click="showAgentForm = !showAgentForm">{{ $t("addAgent") }}</button>

                        <!-- Add Agent Form -->
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

                            <div class="mb-3">
                                <label for="name" class="form-label">{{ $t("Friendly Name") }}</label>
                                <input id="name" v-model="agent.name" type="text" class="form-control" optional>
                            </div>

                            <button type="submit" class="btn btn-primary" :disabled="connectingAgent">
                                <template v-if="connectingAgent">{{ $t("connecting") }}</template>
                                <template v-else>{{ $t("connect") }}</template>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </transition>
    <router-view ref="child" />
</template>

<script>
import { statusNameShort } from "../../../common/util-common";

export default {
    components: {

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
            serverStats: {
                cpu: 0,
                ram: {
                    total: "0 GB",
                    used: "0 GB",
                    percent: 0
                },
                storage: {
                    total: "0 GB",
                    used: "0 GB",
                    percent: 0
                },
                network: [],
                networkSpeed: {
                    rx: "0 B/s",
                    tx: "0 B/s"
                },
                dns: "N/A",
                ping: "N/A",
                system: {
                    os: "N/A",
                    osVersion: "N/A",
                    arch: "N/A",
                    dockerVersion: "N/A"
                }
            },
            showAgentForm: false,
            showRemoveAgentDialog: {},
            showEditAgentNameDialog: {},
            connectingAgent: false,
            agent: {
                url: "http://",
                username: "",
                password: "",
                name: "",
                updatedName: "",
            }
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

        window.addEventListener("resize", this.updatePerPage);
        this.updatePerPage();

        this.$root.getSocket().on("serverStats", (stats) => {
            this.serverStats = stats;
        });
    },

    beforeUnmount() {
        window.removeEventListener("resize", this.updatePerPage);
        this.$root.getSocket().off("serverStats");
    },

    methods: {

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

                    // Remove the stack list and status list of the removed agent
                    delete this.$root.allAgentStackList[endpoint];
                }
            });
        },

        updateName(url, updatedName) {
            this.$root.getSocket().emit("updateAgent", url, updatedName, (res) => {
                this.$root.toastRes(res);

                if (res.ok) {
                    this.showAgentForm = false;
                    this.agent = {
                        updatedName: "",
                    };
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



        /**
         * Updates the displayed records when a new important heartbeat arrives.
         * @param {object} heartbeat - The heartbeat object received.
         * @returns {void}
         */
        onNewImportantHeartbeat(heartbeat) {
            if (this.page === 1) {
                this.displayedRecords.unshift(heartbeat);
                if (this.displayedRecords.length > this.perPage) {
                    this.displayedRecords.pop();
                }
                this.importantHeartBeatListLength += 1;
            }
        },

        /**
         * Retrieves the length of the important heartbeat list for all monitors.
         * @returns {void}
         */
        getImportantHeartbeatListLength() {
            this.$root.getSocket().emit("monitorImportantHeartbeatListCount", null, (res) => {
                if (res.ok) {
                    this.importantHeartBeatListLength = res.count;
                    this.getImportantHeartbeatListPaged();
                }
            });
        },

        /**
         * Retrieves the important heartbeat list for the current page.
         * @returns {void}
         */
        getImportantHeartbeatListPaged() {
            const offset = (this.page - 1) * this.perPage;
            this.$root.getSocket().emit("monitorImportantHeartbeatListPaged", null, offset, this.perPage, (res) => {
                if (res.ok) {
                    this.displayedRecords = res.data;
                }
            });
        },

        /**
         * Updates the number of items shown per page based on the available height.
         * @returns {void}
         */
        updatePerPage() {
            const tableContainer = this.$refs.tableContainer;
            const tableContainerHeight = tableContainer.offsetHeight;
            const availableHeight = window.innerHeight - tableContainerHeight;
            const additionalPerPage = Math.floor(availableHeight / 58);

            if (additionalPerPage > 0) {
                this.perPage = Math.max(this.initialPerPage, this.perPage + additionalPerPage);
            } else {
                this.perPage = this.initialPerPage;
            }

        },
    }
};
</script>

<style lang="scss" scoped>
@import "../styles/vars";

.stat-card {
    border-radius: 12px !important;
    border: none !important;
    transition: transform 0.2s ease, box-shadow 0.2s ease;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
    }

    .stat-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
    }
}

.active-card {
    background-color: var(--m3-success-container) !important;
    color: var(--m3-on-success-container) !important;
    .num {
        color: var(--m3-on-success-container) !important;
    }
}

.exited-card {
    background-color: var(--m3-danger-container) !important;
    color: var(--m3-on-danger-container) !important;
    .num {
        color: var(--m3-on-danger-container) !important;
    }
}

.inactive-card {
    background-color: var(--m3-secondary-container) !important;
    color: var(--m3-on-secondary-container) !important;
    .num {
        color: var(--m3-on-secondary-container) !important;
    }
}

.num {
    font-size: 20px !important;
    font-weight: 700;
    display: block;
}

@media (max-width: 550px) {
    h3 {
        font-size: 1.1rem !important;
    }
    .num {
        font-size: 16px !important;
    }
}

.shadow-box {
    padding: 20px;
}

table {
    font-size: 14px;

    tr {
        transition: all ease-in-out 0.2ms;
    }

    @media (max-width: 550px) {
        table-layout: fixed;
        overflow-wrap: break-word;
    }
}

.docker-run {
    border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px;
}

.first-row .shadow-box {

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

</style>
