<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 v-if="isAdd" class="mb-3">{{ $t("compose") }}</h1>
            <h1 v-else class="mb-3">
                <Uptime :stack="globalStack" :pill="true" /> {{ stack.name }}
                <span v-if="$root.agentCount > 1 && endpoint !== ''" class="agent-name">
                    ({{ endpointDisplay }})
                </span>
            </h1>

            <div v-if="stack.isManagedByDockge" class="d-flex flex-wrap gap-2 mb-3">
                <button v-if="isEditMode" class="btn btn-primary" :disabled="processing" @click="deployStack">
                    <font-awesome-icon icon="rocket" class="me-1" />
                    {{ $t("deployStack") }}
                </button>

                <button v-if="isEditMode" class="btn btn-normal" :disabled="processing" @click="saveStack">
                    <font-awesome-icon icon="save" class="me-1" />
                    {{ $t("saveStackDraft") }}
                </button>

                <button v-if="!isEditMode" class="btn btn-secondary" :disabled="processing" @click="enableEditMode">
                    <font-awesome-icon icon="pen" class="me-1" />
                    {{ $t("editStack") }}
                </button>

                <button v-if="!isEditMode && !active" class="btn btn-primary" :disabled="processing" @click="startStack">
                    <font-awesome-icon icon="play" class="me-1" />
                    {{ $t("startStack") }}
                </button>

                <button v-if="!isEditMode && active" class="btn btn-normal" :disabled="processing" @click="restartStack">
                    <font-awesome-icon icon="rotate" class="me-1" />
                    {{ $t("restartStack") }}
                </button>

                <button v-if="!isEditMode" class="btn btn-normal" :disabled="processing" @click="updateStack">
                    <font-awesome-icon icon="cloud-arrow-down" class="me-1" />
                    {{ $t("updateStack") }}
                </button>

                <button v-if="!isEditMode && active" class="btn btn-normal" :disabled="processing" @click="stopStack">
                    <font-awesome-icon icon="stop" class="me-1" />
                    {{ $t("stopStack") }}
                </button>

                <BDropdown v-if="!isEditMode && active" right text="" variant="normal">
                    <BDropdownItem @click="downStack">
                        <font-awesome-icon icon="stop" class="me-1" />
                        {{ $t("downStack") }}
                    </BDropdownItem>
                </BDropdown>

                <button v-if="isEditMode && !isAdd" class="btn btn-normal" :disabled="processing" @click="discardStack">{{ $t("discardStack") }}</button>
                <button v-if="!isEditMode" class="btn btn-danger" :disabled="processing" @click="showDeleteDialog = !showDeleteDialog">
                    <font-awesome-icon icon="trash" class="me-1" />
                    {{ $t("deleteStack") }}
                </button>
            </div>

            <!-- URLs -->
            <div v-if="urls.length > 0" class="mb-3">
                <a v-for="(urlItem, index) in urls" :key="index" target="_blank" :href="urlItem.url">
                    <span class="badge bg-secondary me-2">{{ urlItem.display }}</span>
                </a>
            </div>

            <!-- Progress Terminal -->
            <transition name="slide-fade" appear>
                <Terminal
                    v-show="showProgressTerminal"
                    ref="progressTerminal"
                    class="mb-3 terminal"
                    :name="terminalName"
                    :endpoint="endpoint"
                    :rows="progressTerminalRows"
                    @has-data="showProgressTerminal = true; submitted = true;"
                ></Terminal>
            </transition>

            <div v-if="stack.isManagedByDockge" class="row">
                <div class="col-lg-6">
                    <!-- General -->
                    <div v-if="isAdd">
                        <h4 class="mb-3">{{ $t("general") }}</h4>
                        <div class="shadow-box big-padding mb-3">
                            <!-- Stack Name -->
                            <div>
                                <label for="name" class="form-label">{{ $t("stackName") }}</label>
                                <input id="name" v-model="stack.name" type="text" class="form-control" required @blur="stackNameToLowercase">
                                <div class="form-text">{{ $t("Lowercase only") }}</div>
                            </div>

                            <!-- Endpoint -->
                            <div class="mt-3">
                                <label for="name" class="form-label">{{ $t("dockgeAgent") }}</label>
                                <select v-model="stack.endpoint" class="form-select">
                                    <option v-for="(agent, agentEndpoint) in $root.agentList" :key="agentEndpoint" :value="agentEndpoint" :disabled="$root.agentStatusList[agentEndpoint] != 'online'">
                                        ({{ $root.agentStatusList[agentEndpoint] }}) {{ (agent.name !== '') ? agent.name : agent.url || $t("Current") }}
                                    </option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Docker Run -->
                    <div v-if="isAdd" class="mb-4">
                        <h4 class="mb-3">{{ $t("Docker Run") }}</h4>
                        <div class="shadow-box big-padding mb-3">
                            <div class="mb-3">
                                <textarea id="docker-run-input" v-model="dockerRunCommand" class="form-control docker-run shadow-box" style="font-family: 'JetBrains Mono', monospace; font-size: 14px;" placeholder="docker run ..."></textarea>
                            </div>
                            <button class="btn btn-normal" type="button" @click="convertDockerRun">{{ $t("Convert to Compose") }}</button>
                        </div>
                    </div>

                    <!-- Containers -->
                    <h4 class="mb-3">{{ $tc("container", 2) }}</h4>

                    <div v-if="isEditMode" class="input-group mb-3">
                        <input
                            v-model="newContainerName"
                            :placeholder="$t(`New Container Name...`)"
                            class="form-control"
                            @keyup.enter="addContainer"
                        />
                        <button class="btn btn-primary" @click="addContainer">
                            {{ $t("addContainer") }}
                        </button>
                    </div>

                    <div ref="containerList">
                        <Container
                            v-for="(service, name) in jsonConfig.services"
                            :key="name"
                            :name="name"
                            :is-edit-mode="isEditMode"
                            :first="name === Object.keys(jsonConfig.services)[0]"
                            :serviceStatus="serviceStatusList[name]"
                            :dockerStats="dockerStats"
                            @start-service="startService"
                            @stop-service="stopService"
                            @restart-service="restartService"
                        />
                    </div>

                    <button v-if="false && isEditMode && jsonConfig.services && Object.keys(jsonConfig.services).length > 0" class="btn btn-normal mb-3" @click="addContainer">{{ $t("addContainer") }}</button>

                    <!-- General -->
                    <div v-if="isEditMode">
                        <h4 class="mb-3">{{ $t("extra") }}</h4>
                        <div class="shadow-box big-padding mb-3">
                            <!-- URLs -->
                            <div class="mb-4">
                                <label class="form-label">
                                    {{ $tc("url", 2) }}
                                </label>
                                <ArrayInput name="urls" :display-name="$t('url')" placeholder="https://" object-type="x-dockge" />
                            </div>
                        </div>
                    </div>

                    <!-- Combined Terminal Output -->
                    <div v-show="!isEditMode">
                        <h4 class="mb-3">{{ $t("terminal") }}</h4>
                        <Terminal
                            ref="combinedTerminal"
                            class="mb-3 terminal"
                            :name="combinedTerminalName"
                            :endpoint="endpoint"
                            :rows="combinedTerminalRows"
                            :cols="combinedTerminalCols"
                            style="height: 315px;"
                        ></Terminal>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <h4 class="m-0">{{ stack.composeFileName }}</h4>
                        <div class="d-flex gap-2">
                            <!-- Import Compose -->
                            <label v-if="isEditMode" class="btn btn-sm btn-outline-primary m-0 d-flex align-items-center gap-2 cursor-pointer py-1 px-3">
                                <font-awesome-icon icon="upload" />
                                <span>{{ $t("Import") }}</span>
                                <input type="file" accept=".yml,.yaml" style="display: none;" @change="importComposeFile">
                            </label>
                            <!-- Export Compose -->
                            <button class="btn btn-sm btn-outline-primary d-flex align-items-center gap-2 py-1 px-3" type="button" @click="exportComposeFile">
                                <font-awesome-icon icon="download" />
                                <span>{{ $t("Export") }}</span>
                            </button>
                        </div>
                    </div>

                    <!-- YAML editor -->
                    <div class="shadow-box mb-3 editor-box" :class="{'edit-mode' : isEditMode}">
                        <code-mirror
                            ref="editor"
                            v-model="stack.composeYAML"
                            :extensions="extensions"
                            minimal
                            wrap="true"
                            dark="true"
                            tab="true"
                            :disabled="!isEditMode"
                            :hasFocus="editorFocus"
                            @change="yamlCodeChange"
                        />
                    </div>
                    <div v-if="isEditMode" class="mb-3">
                        {{ yamlError }}
                    </div>

                    <!-- ENV editor -->
                    <div v-if="isEditMode">
                        <h4 class="mb-3">.env</h4>
                        <div class="shadow-box mb-3 editor-box" :class="{'edit-mode' : isEditMode}">
                            <code-mirror
                                ref="editor"
                                v-model="stack.composeENV"
                                :extensions="extensionsEnv"
                                minimal
                                wrap="true"
                                dark="true"
                                tab="true"
                                :disabled="!isEditMode"
                                :hasFocus="editorFocus"
                                @change="yamlCodeChange"
                            />
                        </div>
                    </div>

                    <div v-if="isEditMode">
                        <!-- Volumes -->
                        <div v-if="false">
                            <h4 class="mb-3">{{ $tc("volume", 2) }}</h4>
                            <div class="shadow-box big-padding mb-3">
                            </div>
                        </div>

                        <!-- Networks -->
                        <h4 class="mb-3">{{ $tc("network", 2) }}</h4>
                        <div class="shadow-box big-padding mb-3">
                            <NetworkInput />
                        </div>
                    </div>

                    <!-- <div class="shadow-box big-padding mb-3">
                        <div class="mb-3">
                            <label for="name" class="form-label"> Search Templates</label>
                            <input id="name" v-model="name" type="text" class="form-control" placeholder="Search..." required>
                        </div>

                        <prism-editor v-if="false" v-model="yamlConfig" class="yaml-editor" :highlight="highlighter" line-numbers @input="yamlCodeChange"></prism-editor>
                    </div>-->
                </div>
            </div>

            <div v-if="!stack.isManagedByDockge && !processing">
                {{ $t("stackNotManagedByDockgeMsg") }}
            </div>

            <!-- Delete Dialog -->
            <BModal v-model="showDeleteDialog" :cancelTitle="$t('cancel')" :okTitle="$t('deleteStack')" okVariant="danger" @ok="deleteDialog">
                {{ $t("deleteStackMsg") }}
            </BModal>

            <!-- Pre-deployment Scan Warning Dialog -->
            <div v-if="scanningImages || showScanWarningDialog" class="modal fade show d-block" style="background: rgba(0,0,0,0.5); z-index: 1050;" tabindex="-1">
                <div class="modal-dialog modal-xl modal-dialog-centered">
                    <div class="modal-content text-white shadow-lg" style="background-color: var(--m3-surface-container); border: 1px solid rgba(120, 120, 120, 0.25); border-radius: var(--m3-card-radius);">
                        <div class="modal-header border-bottom border-secondary border-opacity-20 py-3 px-4">
                            <h5 class="modal-title text-warning fw-bold d-flex align-items-center gap-2">
                                <font-awesome-icon icon="exclamation-triangle" />
                                <span>Image Security Scan Results</span>
                            </h5>
                        </div>
                        <div class="modal-body p-4" style="max-height: 65vh; overflow-y: auto;">
                            <!-- Loading State -->
                            <div v-if="scanningImages" class="text-center py-4">
                                <div class="spinner-border text-warning mb-3" role="status"></div>
                                <p class="fs-5 fw-semibold">{{ scanProgressText }}</p>
                                
                                <div class="progress mb-3 mx-auto" style="height: 12px; max-width: 600px; border-radius: 6px; background-color: rgba(255,255,255,0.1); overflow: hidden;">
                                    <div class="progress-bar progress-bar-striped progress-bar-animated bg-warning" role="progressbar" :style="{ width: progressPercent + '%' }"></div>
                                </div>
                                
                                <div class="d-flex justify-content-between text-secondary small mx-auto" style="max-width: 600px;">
                                    <span>Progress: {{ progressPercent }}%</span>
                                    <span>Time Elapsed: {{ scanElapsedTime }}s</span>
                                </div>
                            </div>

                            <!-- Findings State -->
                            <div v-else>
                                <div v-if="scanError" class="alert alert-warning mb-3">
                                    <strong>Scan Error occurred:</strong> {{ scanError }}
                                </div>

                                <p class="mb-4 fs-6">The security scan found <strong class="text-warning">{{ scanResults.length }}</strong> vulnerability matches in stack service images. Review findings before deploying:</p>

                                <div class="row g-4">
                                    <!-- Trivy Column -->
                                    <div class="col-lg-6 col-12 border-end border-secondary border-opacity-20">
                                        <div class="p-2 mb-3 d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-20">
                                            <h6 class="text-info fw-bold mb-0">Trivy Vulnerabilities</h6>
                                            <span class="badge bg-info">{{ trivyScanResults.length }}</span>
                                        </div>
                                        <div v-if="trivyScanResults.length > 0" class="table-responsive" style="border-radius: 8px; border: 1px solid rgba(120, 120, 120, 0.15);">
                                            <table class="table table-hover table-dark mb-0 align-middle">
                                                <thead>
                                                    <tr>
                                                        <th>Image</th>
                                                        <th>Severity</th>
                                                        <th>CVE ID</th>
                                                        <th>Current Version</th>
                                                        <th>Fixed Version</th>
                                                        <th>Info</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr v-for="(vuln, idx) in trivyScanResults" :key="idx">
                                                        <td class="font-monospace small text-truncate" style="max-width: 100px;">{{ vuln.imageName }}</td>
                                                        <td>
                                                            <span class="badge" :class="severityClass(vuln.severity)">
                                                                {{ vuln.severity }}
                                                            </span>
                                                        </td>
                                                        <td class="fw-semibold small">{{ vuln.id }}</td>
                                                        <td class="font-monospace text-secondary small">{{ vuln.installedVersion }}</td>
                                                        <td class="font-monospace text-success small">{{ vuln.fixedVersion }}</td>
                                                        <td>
                                                            <a :href="vuln.url" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size: 11px;">
                                                                Link
                                                            </a>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <div v-else class="alert alert-success py-3 text-center small">
                                            No Trivy vulnerabilities found
                                        </div>
                                    </div>

                                    <!-- Grype Column -->
                                    <div class="col-lg-6 col-12">
                                        <div class="p-2 mb-3 d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-20">
                                            <h6 class="text-primary fw-bold mb-0">Grype Vulnerabilities</h6>
                                            <span class="badge bg-primary">{{ grypeScanResults.length }}</span>
                                        </div>
                                        <div v-if="grypeScanResults.length > 0" class="table-responsive" style="border-radius: 8px; border: 1px solid rgba(120, 120, 120, 0.15);">
                                            <table class="table table-hover table-dark mb-0 align-middle">
                                                <thead>
                                                    <tr>
                                                        <th>Image</th>
                                                        <th>Severity</th>
                                                        <th>CVE ID</th>
                                                        <th>Current Version</th>
                                                        <th>Fixed Version</th>
                                                        <th>Info</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr v-for="(vuln, idx) in grypeScanResults" :key="idx">
                                                        <td class="font-monospace small text-truncate" style="max-width: 100px;">{{ vuln.imageName }}</td>
                                                        <td>
                                                            <span class="badge" :class="severityClass(vuln.severity)">
                                                                {{ vuln.severity }}
                                                            </span>
                                                        </td>
                                                        <td class="fw-semibold small">{{ vuln.id }}</td>
                                                        <td class="font-monospace text-secondary small">{{ vuln.installedVersion }}</td>
                                                        <td class="font-monospace text-success small">{{ vuln.fixedVersion }}</td>
                                                        <td>
                                                            <a :href="vuln.url" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size: 11px;">
                                                                Link
                                                            </a>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <div v-else class="alert alert-success py-3 text-center small">
                                            No Grype vulnerabilities found
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer border-top border-secondary border-opacity-20 py-3 px-4">
                            <template v-if="!scanningImages">
                                <button type="button" class="btn btn-secondary px-3" @click="showScanWarningDialog = false">
                                    Cancel Deployment
                                </button>
                                <button type="button" class="btn btn-danger px-3" @click="showScanWarningDialog = false; deployStack(true)">
                                    Deploy Anyway
                                </button>
                            </template>
                            <template v-else>
                                <button type="button" class="btn btn-secondary" disabled>
                                    Scanning in progress...
                                </button>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Deploy Option Choice Dialog -->
            <div v-if="showDeployChoiceDialog" class="modal fade show d-block" style="background: rgba(0,0,0,0.5); z-index: 1050;" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content text-white shadow-lg" style="background-color: var(--m3-surface-container); border: 1px solid rgba(120, 120, 120, 0.25); border-radius: var(--m3-card-radius);">
                        <div class="modal-header border-bottom border-secondary border-opacity-20 py-3 px-4">
                            <h5 class="modal-title fw-bold">Security Scan Recommendation</h5>
                        </div>
                        <div class="modal-body p-4">
                            <p class="fs-6">Optional vulnerability scanning is enabled. Would you like to run a security scan on service images before deploying?</p>
                        </div>
                        <div class="modal-footer border-top border-secondary border-opacity-20 py-3 px-4">
                            <button type="button" class="btn btn-secondary px-3" @click="showDeployChoiceDialog = false">
                                Cancel
                            </button>
                            <button type="button" class="btn btn-outline-primary px-3" @click="showDeployChoiceDialog = false; deployStack(true)">
                                Deploy Directly
                            </button>
                            <button type="button" class="btn btn-primary px-3" @click="runPreDeployScan">
                                Scan & Deploy
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
import CodeMirror from "vue-codemirror6";
import { yaml } from "@codemirror/lang-yaml";
import { python } from "@codemirror/lang-python";
import { dracula as editorTheme } from "thememirror";
import { lineNumbers, EditorView } from "@codemirror/view";
import { parseDocument, Document } from "yaml";

import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import {
    COMBINED_TERMINAL_COLS,
    COMBINED_TERMINAL_ROWS,
    copyYAMLComments, envsubstYAML,
    getCombinedTerminalName,
    getComposeTerminalName,
    PROGRESS_TERMINAL_ROWS,
    RUNNING
} from "../../../common/util-common";
import { BModal } from "bootstrap-vue-next";
import NetworkInput from "../components/NetworkInput.vue";
import dotenv from "dotenv";
import { ref } from "vue";

const template = `
services:
  nginx:
    image: nginx:latest
    restart: unless-stopped
    ports:
      - "8080:80"
`;
const envDefault = "# VARIABLE=value #comment";

let yamlErrorTimeout = null;

let serviceStatusTimeout = null;
let dockerStatsTimeout = null;

export default {
    components: {
        NetworkInput,
        FontAwesomeIcon,
        CodeMirror,
        BModal,
    },
    beforeRouteUpdate(to, from, next) {
        this.exitConfirm(next);
    },
    beforeRouteLeave(to, from, next) {
        this.exitConfirm(next);
    },
    beforeUnmount() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    },
    setup() {
        const editorFocus = ref(false);

        const focusEffectHandler = (state, focusing) => {
            editorFocus.value = focusing;
            return null;
        };

        const extensions = [
            editorTheme,
            yaml(),
            lineNumbers(),
            EditorView.focusChangeEffect.of(focusEffectHandler)
        ];

        const extensionsEnv = [
            editorTheme,
            python(),
            lineNumbers(),
            EditorView.focusChangeEffect.of(focusEffectHandler)
        ];

        return { extensions,
            extensionsEnv,
            editorFocus };
    },
    yamlDoc: null,  // For keeping the yaml comments
    data() {
        return {
            dockerRunCommand: "",
            scanningImages: false,
            showScanWarningDialog: false,
            showDeployChoiceDialog: false,
            scanResults: [],
            scanError: "",
            scanProgressText: "",
            progressPercent: 0,
            scanElapsedTime: 0,
            timerInterval: null,
            jsonConfig: {},
            envsubstJSONConfig: {},
            yamlError: "",
            processing: true,
            showProgressTerminal: false,
            progressTerminalRows: PROGRESS_TERMINAL_ROWS,
            combinedTerminalRows: COMBINED_TERMINAL_ROWS,
            combinedTerminalCols: COMBINED_TERMINAL_COLS,
            stack: {

            },
            serviceStatusList: {},
            dockerStats: {},
            isEditMode: false,
            submitted: false,
            showDeleteDialog: false,
            newContainerName: "",
            stopServiceStatusTimeout: false,
            stopDockerStatsTimeout: false,
        };
    },
    computed: {
        endpointDisplay() {
            return this.$root.endpointDisplayFunction(this.endpoint);
        },

        urls() {
            if (!this.envsubstJSONConfig["x-dockge"] || !this.envsubstJSONConfig["x-dockge"].urls || !Array.isArray(this.envsubstJSONConfig["x-dockge"].urls)) {
                return [];
            }

            let urls = [];
            for (const url of this.envsubstJSONConfig["x-dockge"].urls) {
                let display;
                try {
                    let obj = new URL(url);
                    let pathname = obj.pathname;
                    if (pathname === "/") {
                        pathname = "";
                    }
                    display = obj.host + pathname + obj.search;
                } catch (e) {
                    display = url;
                }

                urls.push({
                    display,
                    url,
                });
            }
            return urls;
        },

        trivyScanResults() {
            return this.scanResults.filter(v => v.scanner === "Trivy");
        },

        grypeScanResults() {
            return this.scanResults.filter(v => v.scanner === "Grype");
        },

        isAdd() {
            return this.$route.path === "/compose" && !this.submitted;
        },

        /**
         * Get the stack from the global stack list, because it may contain more real-time data like status
         * @return {*}
         */
        globalStack() {
            return this.$root.completeStackList[this.stack.name + "_" + this.endpoint];
        },

        status() {
            return this.globalStack?.status;
        },

        active() {
            return this.status === RUNNING;
        },

        terminalName() {
            if (!this.stack.name) {
                return "";
            }
            return getComposeTerminalName(this.endpoint, this.stack.name);
        },

        combinedTerminalName() {
            if (!this.stack.name) {
                return "";
            }
            return getCombinedTerminalName(this.endpoint, this.stack.name);
        },

        networks() {
            return this.jsonConfig.networks;
        },

        endpoint() {
            return this.stack.endpoint || this.$route.params.endpoint || "";
        },

        url() {
            if (this.stack.endpoint) {
                return `/compose/${this.stack.name}/${this.stack.endpoint}`;
            } else {
                return `/compose/${this.stack.name}`;
            }
        },
    },
    watch: {
        "stack.composeYAML": {
            handler() {
                if (this.editorFocus) {
                    console.debug("yaml code changed");
                    this.yamlCodeChange();
                }
            },
            deep: true,
        },

        "stack.composeENV": {
            handler() {
                if (this.editorFocus) {
                    console.debug("env code changed");
                    this.yamlCodeChange();
                }
            },
            deep: true,
        },

        jsonConfig: {
            handler() {
                if (!this.editorFocus) {
                    console.debug("jsonConfig changed");

                    let doc = new Document(this.jsonConfig);

                    // Stick back the yaml comments
                    if (this.yamlDoc) {
                        copyYAMLComments(doc, this.yamlDoc);
                    }

                    this.stack.composeYAML = doc.toString();
                    this.yamlDoc = doc;
                }
            },
            deep: true,
        },

        $route(to, from) {

        }
    },
    mounted() {
        if (this.isAdd) {
            this.processing = false;
            this.isEditMode = true;

            let composeYAML;
            let composeENV;

            if (this.$root.composeTemplate) {
                composeYAML = this.$root.composeTemplate;
                this.$root.composeTemplate = "";
            } else {
                composeYAML = template;
            }
            if (this.$root.envTemplate) {
                composeENV = this.$root.envTemplate;
                this.$root.envTemplate = "";
            } else {
                composeENV = envDefault;
            }

            // Default Values
            this.stack = {
                name: "",
                composeYAML,
                composeENV,
                isManagedByDockge: true,
                endpoint: "",
            };

            this.yamlCodeChange();

        } else {
            this.stack.name = this.$route.params.stackName;
            this.loadStack();
        }

        this.requestServiceStatus();
        this.requestDockerStats();
    },
    unmounted() {

    },
    methods: {
        convertDockerRun() {
            if (!this.dockerRunCommand || this.dockerRunCommand.trim() === "docker run") {
                this.$root.toastError("Please enter a docker run command");
                return;
            }

            this.$root.getSocket().emit("composerize", this.dockerRunCommand, (res) => {
                if (res.ok) {
                    this.stack.composeYAML = res.composeTemplate;
                    this.dockerRunCommand = "";
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        startServiceStatusTimeout() {
            clearTimeout(serviceStatusTimeout);
            serviceStatusTimeout = setTimeout(async () => {
                this.requestServiceStatus();
            }, 5000);
        },

        startDockerStatsTimeout() {
            clearTimeout(dockerStatsTimeout);
            dockerStatsTimeout = setTimeout(async () => {
                this.requestDockerStats();
            }, 5000);
        },

        requestServiceStatus() {
            // Do not request if it is add mode
            if (this.isAdd) {
                return;
            }

            this.$root.emitAgent(this.endpoint, "serviceStatusList", this.stack.name, (res) => {
                if (res.ok) {
                    this.serviceStatusList = res.serviceStatusList;
                }
                if (!this.stopServiceStatusTimeout) {
                    this.startServiceStatusTimeout();
                }
            });
        },

        requestDockerStats() {
            this.$root.emitAgent(this.endpoint, "dockerStats", (res) => {
                if (res.ok) {
                    this.dockerStats = res.dockerStats;
                }
                if (!this.stopDockerStatsTimeout) {
                    this.startDockerStatsTimeout();
                }
            });
        },

        exitConfirm(next) {
            if (this.isEditMode) {
                if (confirm(this.$t("confirmLeaveStack"))) {
                    this.exitAction();
                    next();
                } else {
                    next(false);
                }
            } else {
                this.exitAction();
                next();
            }
        },

        exitAction() {
            console.log("exitAction");
            this.stopServiceStatusTimeout = true;
            this.stopDockerStatsTimeout = true;
            clearTimeout(serviceStatusTimeout);
            clearTimeout(dockerStatsTimeout);

            // Leave Combined Terminal
            console.debug("leaveCombinedTerminal", this.endpoint, this.stack.name);
            this.$root.emitAgent(this.endpoint, "leaveCombinedTerminal", this.stack.name, () => {});
        },

        bindTerminal() {
            this.$refs.progressTerminal?.bind(this.endpoint, this.terminalName);
        },

        loadStack() {
            this.processing = true;
            this.$root.emitAgent(this.endpoint, "getStack", this.stack.name, (res) => {
                if (res.ok) {
                    this.stack = res.stack;
                    this.yamlCodeChange();
                    this.processing = false;
                    this.bindTerminal();
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        async deployStack(bypassScan = false) {
            this.processing = true;

            if (!this.jsonConfig.services) {
                this.$root.toastError("No services found in compose.yaml");
                this.processing = false;
                return;
            }

            // Check if services is object
            if (typeof this.jsonConfig.services !== "object") {
                this.$root.toastError("Services must be an object");
                this.processing = false;
                return;
            }

            let serviceNameList = Object.keys(this.jsonConfig.services);

            // Set the stack name if empty, use the first container name
            if (!this.stack.name && serviceNameList.length > 0) {
                let serviceName = serviceNameList[0];
                let service = this.jsonConfig.services[serviceName];

                if (service && service.container_name) {
                    this.stack.name = service.container_name;
                } else {
                    this.stack.name = serviceName;
                }
            }

            // Extract images
            const images = [];
            if (this.jsonConfig.services) {
                for (const service of Object.values(this.jsonConfig.services)) {
                    if (service && typeof service === "object" && typeof service.image === "string") {
                        images.push(service.image);
                    }
                }
            }

            // Retrieve settings
            const settings = this.$root.settings || {};
            const scanner = (settings.enableTrivyScan && settings.enableGrypeScan) ? "both" : 
                            settings.enableTrivyScan ? "trivy" : 
                            settings.enableGrypeScan ? "grype" : null;

            if (scanner && images.length > 0 && !bypassScan) {
                this.showDeployChoiceDialog = true;
                this.processing = false;
                return;
            }

            this.bindTerminal();

            this.$root.emitAgent(this.stack.endpoint, "deployStack", this.stack.name, this.stack.composeYAML, this.stack.composeENV, this.isAdd, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.isEditMode = false;
                    this.$router.push(this.url);
                }
            });
        },

        async runPreDeployScan() {
            this.showDeployChoiceDialog = false;
            this.scanningImages = true;
            this.scanResults = [];
            this.scanError = "";
            this.scanProgressText = "Preparing image scanner...";
            this.progressPercent = 5;

            // Extract images
            const images = [];
            if (this.jsonConfig.services) {
                for (const service of Object.values(this.jsonConfig.services)) {
                    if (service && typeof service === "object" && typeof service.image === "string") {
                        images.push(service.image);
                    }
                }
            }

            const totalImages = images.length;
            this.scanStartTime = Date.now();
            this.scanElapsedTime = 0;
            this.timerInterval = setInterval(() => {
                this.scanElapsedTime = Math.floor((Date.now() - this.scanStartTime) / 1000);
            }, 1000);

            let currentImgIndex = 0;
            let subStepPercent = 0;

            const progressListener = (data) => {
                this.scanProgressText = `[${data.image}] (${currentImgIndex + 1}/${totalImages}): ${data.message}`;
                if (data.step === "trivy_pull") subStepPercent = 25;
                else if (data.step === "trivy_scan") subStepPercent = 50;
                else if (data.step === "grype_pull") subStepPercent = 75;
                else if (data.step === "grype_scan") subStepPercent = 90;
                else if (data.step === "done") subStepPercent = 100;
                
                this.progressPercent = Math.min(100, Math.floor(((currentImgIndex + (subStepPercent / 100)) / totalImages) * 100));
            };
            this.$root.getSocket().on("scanProgress", progressListener);

            const settings = this.$root.settings || {};
            const scanner = (settings.enableTrivyScan && settings.enableGrypeScan) ? "both" : 
                            settings.enableTrivyScan ? "trivy" : 
                            settings.enableGrypeScan ? "grype" : null;

            // Scan each image sequentially
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                currentImgIndex = i;
                subStepPercent = 0;
                this.scanProgressText = `Scanning image [${img}] (${i + 1}/${totalImages})...`;
                await new Promise((resolve) => {
                    this.$root.getSocket().emit("scanImage", img, scanner, (res) => {
                        if (res.ok && res.vulnerabilities) {
                            this.scanResults.push(...res.vulnerabilities.map(v => ({ ...v, imageName: img })));
                        }
                        if (res.error) {
                            this.scanError += `[${img}]: ${res.error}. `;
                        }
                        resolve();
                    });
                });
            }

            clearInterval(this.timerInterval);
            this.$root.getSocket().off("scanProgress", progressListener);
            this.scanningImages = false;

            if (this.scanResults.length > 0 || this.scanError) {
                this.showScanWarningDialog = true;
            } else {
                this.deployStack(true);
            }
        },

        severityClass(severity) {
            const sev = severity ? severity.toUpperCase() : "";
            if (sev === "CRITICAL" || sev === "HIGH") return "bg-danger text-white";
            if (sev === "MEDIUM") return "bg-warning text-dark";
            return "bg-info text-dark";
        },

        saveStack() {
            this.processing = true;

            this.$root.emitAgent(this.stack.endpoint, "saveStack", this.stack.name, this.stack.composeYAML, this.stack.composeENV, this.isAdd, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.isEditMode = false;
                    this.$router.push(this.url);
                }
            });
        },

        startStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "startStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        stopStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "stopStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        downStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "downStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        restartStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "restartStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        updateStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "updateStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        deleteDialog() {
            this.$root.emitAgent(this.endpoint, "deleteStack", this.stack.name, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.$router.push("/");
                }
            });
        },

        discardStack() {
            this.loadStack();
            this.isEditMode = false;
        },

        yamlToJSON(yaml) {
            let doc = parseDocument(yaml);
            if (doc.errors.length > 0) {
                throw doc.errors[0];
            }

            const config = doc.toJS() ?? {};

            // Check data types
            // "services" must be an object
            if (!config.services) {
                config.services = {};
            }

            if (Array.isArray(config.services) || typeof config.services !== "object") {
                throw new Error("Services must be an object");
            }

            return {
                config,
                doc,
            };
        },

        yamlCodeChange() {
            try {
                let { config, doc } = this.yamlToJSON(this.stack.composeYAML);

                this.yamlDoc = doc;
                this.jsonConfig = config;

                let env = dotenv.parse(this.stack.composeENV);
                let envYAML = envsubstYAML(this.stack.composeYAML, env);
                this.envsubstJSONConfig = this.yamlToJSON(envYAML).config;

                clearTimeout(yamlErrorTimeout);
                this.yamlError = "";
            } catch (e) {
                clearTimeout(yamlErrorTimeout);

                if (this.yamlError) {
                    this.yamlError = e.message;

                } else {
                    yamlErrorTimeout = setTimeout(() => {
                        this.yamlError = e.message;
                    }, 3000);
                }
            }
        },

        enableEditMode() {
            this.isEditMode = true;
        },

        checkYAML() {

        },

        addContainer() {
            this.checkYAML();

            if (this.jsonConfig.services[this.newContainerName]) {
                this.$root.toastError("Container name already exists");
                return;
            }

            if (!this.newContainerName) {
                this.$root.toastError("Container name cannot be empty");
                return;
            }

            this.jsonConfig.services[this.newContainerName] = {
                restart: "unless-stopped",
            };
            this.newContainerName = "";
            let element = this.$refs.containerList.lastElementChild;
            element.scrollIntoView({
                block: "start",
                behavior: "smooth"
            });
        },

        stackNameToLowercase() {
            this.stack.name = this.stack?.name?.toLowerCase();
        },

        startService(serviceName) {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "startService", this.stack.name, serviceName, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.requestServiceStatus(); // Refresh service status
                }
            });
        },

        stopService(serviceName) {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "stopService", this.stack.name, serviceName, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.requestServiceStatus(); // Refresh service status
                }
            });
        },

        restartService(serviceName) {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "restartService", this.stack.name, serviceName, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.requestServiceStatus(); // Refresh service status
                }
            });
        },

        importComposeFile(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                this.stack.composeYAML = content;
                this.$root.toastSuccess("Compose file imported successfully");
            };
            reader.readAsText(file);
            event.target.value = "";
        },

        exportComposeFile() {
            if (!this.stack.composeYAML) {
                this.$root.toastError("No compose content to export");
                return;
            }
            const blob = new Blob([this.stack.composeYAML], { type: "text/yaml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = this.stack.composeFileName || "docker-compose.yml";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            this.$root.toastSuccess("Compose file exported successfully");
        },
    }
};
</script>

<style scoped lang="scss">
@import "../styles/vars.scss";

.terminal {
    height: 200px;
}

.editor-box {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
}

.agent-name {
    font-size: 13px;
    color: $dark-font-color3;
}
</style>
