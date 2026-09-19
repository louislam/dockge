<template>
    <transition name="slide-fade" appear>
        <div class="files-page">
            <div class="page-header mb-3">
                <div>
                    <h1 class="mb-1">{{ $t("files") }}</h1>
                    <div class="text-muted small">{{ $t("fileManagerRestrictedHint") }}</div>
                </div>
                <select v-model="selectedEndpoint" class="form-select endpoint-select" @change="switchEndpoint">
                    <option v-for="option in endpointOptions" :key="option.value" :value="option.value" :disabled="option.offline">
                        {{ option.label }}{{ option.offline ? ` (${$t('agentOffline')})` : "" }}
                    </option>
                </select>
            </div>

            <div v-if="loadingInfo" class="shadow-box big-padding">{{ $t("loading") }}</div>
            <div v-else-if="!info.enabled" class="alert alert-warning shadow-box">
                <h4>{{ $t("fileManagerDisabled") }}</h4>
                <p class="mb-2">{{ $t("fileManagerDisabledHint") }}</p>
                <code>DOCKGE_FILE_MANAGER_ROOT=/managed-files</code>
            </div>

            <template v-else>
                <div class="file-toolbar shadow-box mb-3">
                    <nav class="breadcrumbs" :aria-label="$t('breadcrumb')">
                        <button class="crumb" :aria-label="$t('rootDirectory')" :title="$t('rootDirectory')" @click="openDirectory('')"><font-awesome-icon icon="folder-open" /></button>
                        <template v-for="crumb in breadcrumbs" :key="crumb.path">
                            <span>/</span>
                            <button class="crumb" @click="openDirectory(crumb.path)">{{ crumb.name }}</button>
                        </template>
                    </nav>
                    <div class="toolbar-actions">
                        <button class="btn btn-normal" :disabled="busy" @click="refresh"><font-awesome-icon icon="arrows-rotate" /> <span>{{ $t("refresh") }}</span></button>
                        <button class="btn btn-normal" :disabled="busy" @click="openCreate('directory')"><font-awesome-icon icon="folder" /> <span>{{ $t("newFolder") }}</span></button>
                        <button class="btn btn-normal" :disabled="busy" @click="openCreate('file')"><font-awesome-icon icon="file" /> <span>{{ $t("newTextFile") }}</span></button>
                        <button class="btn btn-primary" :disabled="busy" @click="$refs.fileInput.click()"><font-awesome-icon icon="upload" /> <span>{{ $t("uploadFiles") }}</span></button>
                        <input ref="fileInput" class="d-none" type="file" multiple @change="selectFiles" />
                    </div>
                </div>

                <div
                    class="file-list shadow-box"
                    :class="{ dragging: dragActive }"
                    @dragenter.prevent="dragActive = true"
                    @dragover.prevent="dragActive = true"
                    @dragleave.prevent="dragActive = false"
                    @drop.prevent="dropFiles"
                >
                    <div v-if="busy && !transfer" class="loading-overlay">{{ $t("loading") }}</div>

                    <div class="desktop-file-table table-responsive">
                        <table class="table align-middle mb-0">
                            <thead><tr><th>{{ $t("fileName") }}</th><th>{{ $t("type") }}</th><th>{{ $t("size") }}</th><th>{{ $t("modifiedAt") }}</th><th class="text-end">{{ $t("actions") }}</th></tr></thead>
                            <tbody>
                                <tr v-if="entries.length === 0 && !busy">
                                    <td colspan="5" class="empty-state">{{ $t("emptyDirectory") }}</td>
                                </tr>
                                <tr v-for="entry in entries" :key="entry.path">
                                    <td><button class="file-name" @click="openEntry(entry)"><font-awesome-icon :icon="entry.type === 'directory' ? 'folder' : 'file'" /> {{ entry.name }}</button></td>
                                    <td>{{ $t(`fileType.${entry.type}`) }}</td>
                                    <td>{{ entry.type === "file" ? formatSize(entry.size) : "—" }}</td>
                                    <td>{{ formatDate(entry.modifiedAt) }}</td>
                                    <td>
                                        <div class="row-actions">
                                            <button v-if="entry.type === 'file'" class="btn btn-sm btn-normal" @click="download(entry)"><font-awesome-icon icon="download" /> {{ $t("download") }}</button>
                                            <button v-if="canView(entry)" class="btn btn-sm btn-normal" @click="openLog(entry)"><font-awesome-icon icon="eye" /> {{ $t(isLogEntry(entry) ? "viewLog" : "viewReadOnly") }}</button>
                                            <button
                                                v-if="entry.type === 'file' && !isKnownBinary(entry)"
                                                class="btn btn-sm btn-normal"
                                                :disabled="isEditTooLarge(entry)"
                                                :title="isEditTooLarge(entry) ? $t('fileTooLargeToEdit') : $t('Edit')"
                                                @click="edit(entry)"
                                            >
                                                <font-awesome-icon icon="file-pen" /> {{ $t("Edit") }}
                                            </button>
                                            <button class="btn btn-sm btn-normal" @click="openRename(entry)">{{ $t("rename") }}</button>
                                            <button class="btn btn-sm btn-normal" @click="openMove(entry)">{{ $t("move") }}</button>
                                            <button class="btn btn-sm btn-danger" @click="openDelete(entry)"><font-awesome-icon icon="trash" /></button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="mobile-file-cards">
                        <div v-if="entries.length === 0 && !busy" class="empty-state">{{ $t("emptyDirectory") }}</div>
                        <article v-for="entry in entries" :key="entry.path" class="file-card">
                            <button class="file-card-main" @click="openEntry(entry)">
                                <font-awesome-icon class="file-card-icon" :icon="entry.type === 'directory' ? 'folder' : 'file'" />
                                <span><strong>{{ entry.name }}</strong><small>{{ $t(`fileType.${entry.type}`) }} · {{ entry.type === "file" ? formatSize(entry.size) : formatDate(entry.modifiedAt) }}</small></span>
                            </button>
                            <div class="file-card-actions">
                                <button v-if="entry.type === 'file'" class="btn btn-sm btn-normal" :aria-label="$t('download')" @click="download(entry)"><font-awesome-icon icon="download" /></button>
                                <button v-if="canView(entry)" class="btn btn-sm btn-normal" :aria-label="$t(isLogEntry(entry) ? 'viewLog' : 'viewReadOnly')" @click="openLog(entry)"><font-awesome-icon icon="eye" /></button>
                                <button
                                    v-if="entry.type === 'file' && !isKnownBinary(entry)"
                                    class="btn btn-sm btn-normal"
                                    :disabled="isEditTooLarge(entry)"
                                    :aria-label="isEditTooLarge(entry) ? $t('fileTooLargeToEdit') : $t('Edit')"
                                    @click="edit(entry)"
                                >
                                    <font-awesome-icon icon="file-pen" />
                                </button>
                                <BDropdown right text="" size="sm" variant="normal">
                                    <BDropdownItem @click="openRename(entry)">{{ $t("rename") }}</BDropdownItem>
                                    <BDropdownItem @click="openMove(entry)">{{ $t("move") }}</BDropdownItem>
                                    <BDropdownItem @click="openDelete(entry)">{{ $t("Delete") }}</BDropdownItem>
                                </BDropdown>
                            </div>
                        </article>
                    </div>
                </div>

                <div v-if="total > limit" class="pagination-bar mt-3">
                    <button class="btn btn-normal" :disabled="offset === 0 || busy" @click="changePage(-1)">{{ $t("previous") }}</button>
                    <span>{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} / {{ total }}</span>
                    <button class="btn btn-normal" :disabled="offset + limit >= total || busy" @click="changePage(1)">{{ $t("next") }}</button>
                </div>

                <div v-if="transfer" class="transfer-panel shadow-box">
                    <div class="d-flex justify-content-between gap-2"><strong>{{ transfer.label }}</strong><button class="btn btn-sm btn-normal" @click="cancelTransfer">{{ $t("cancel") }}</button></div>
                    <div class="progress mt-2"><div class="progress-bar" :style="{ width: `${transfer.percent}%` }">{{ transfer.percent }}%</div></div>
                </div>
            </template>

            <BModal v-model="showCreate" :title="createType === 'directory' ? $t('newFolder') : $t('newTextFile')" :ok-title="$t('Create')" :cancel-title="$t('cancel')" @ok="createEntry">
                <label class="form-label" for="new-entry-name">{{ $t("fileName") }}</label>
                <input id="new-entry-name" v-model="newName" class="form-control" @keyup.enter="createEntry" />
            </BModal>

            <BModal v-model="showRename" :title="$t('rename')" :ok-title="$t('rename')" :cancel-title="$t('cancel')" @ok="renameEntry">
                <label class="form-label" for="rename-entry">{{ $t("fileName") }}</label>
                <input id="rename-entry" v-model="renameName" class="form-control" />
            </BModal>

            <BModal v-model="showMove" :title="$t('move')" :ok-title="$t('move')" :cancel-title="$t('cancel')" @ok="moveEntry">
                <label class="form-label" for="move-destination">{{ $t("destinationDirectory") }}</label>
                <input id="move-destination" v-model="moveDestination" class="form-control" placeholder="/" />
                <div class="form-text">{{ $t("destinationDirectoryHint") }}</div>
            </BModal>

            <BModal v-model="showDelete" :title="$t('confirmDelete')" :ok-title="$t('Delete')" ok-variant="danger" :cancel-title="$t('cancel')" @ok="deleteEntry">
                {{ $t("fileDeleteConfirm", { name: activeEntry?.name }) }}
            </BModal>

            <BModal v-model="showEditor" modal-class="file-editor-modal" :title="editor.name" size="xl" :ok-title="$t('Save')" :cancel-title="$t('cancel')" @ok="saveEditor">
                <div class="editor-meta"><span>{{ editor.languageName }}</span><span>UTF-8</span></div>
                <div class="text-editor">
                    <FileTextEditor
                        :key="editorSession"
                        ref="textEditor"
                        :content="editor.content"
                        :language-support="editor.languageSupport"
                        :dark="$root.isDark"
                    />
                </div>
            </BModal>

            <BModal
                v-model="showLogViewer"
                modal-class="file-log-modal"
                :title="$t('logViewerTitle', { name: logEntry?.name || '' })"
                size="xl"
                hide-footer
                @hidden="stopLogPolling"
            >
                <div class="log-viewer-toolbar">
                    <button class="btn btn-sm btn-normal" :class="{ active: logFollow }" @click="toggleLogFollow">
                        <font-awesome-icon :icon="logFollow ? 'pause' : 'play'" /> {{ $t(logFollow ? "pauseFollow" : "resumeFollow") }}
                    </button>
                    <button class="btn btn-sm btn-normal" :disabled="!logHasSelection" @click="copyLogSelection"><font-awesome-icon icon="copy" /> {{ $t("copySelection") }}</button>
                    <button class="btn btn-sm btn-normal" @click="clearLogDisplay"><font-awesome-icon icon="trash" /> {{ $t("clearDisplay") }}</button>
                    <button class="btn btn-sm btn-normal" :disabled="logLoading" @click="reloadLog"><font-awesome-icon icon="arrows-rotate" /> {{ $t("reloadLog") }}</button>
                    <button v-if="logEntry" class="btn btn-sm btn-normal" :disabled="busy" @click="download(logEntry)"><font-awesome-icon icon="download" /> {{ $t("download") }}</button>
                    <button v-if="logHasNewContent && !logFollow" class="btn btn-sm btn-primary ms-auto" @click="resumeLogFollow">{{ $t("newLogContent") }}</button>
                    <span v-else-if="logLoading" class="log-viewer-status ms-auto">{{ $t("loading") }}</span>
                </div>
                <div v-if="logNotice" class="alert alert-info py-2 mb-2">{{ logNotice }}</div>
                <div v-if="logError" class="alert alert-danger py-2 mb-2">
                    <span>{{ logError }}</span>
                    <button class="btn btn-sm btn-danger ms-2" @click="reloadLog">{{ $t("retry") }}</button>
                </div>
                <div class="log-viewer-body">
                    <FileLogViewer
                        v-if="showLogViewer"
                        :key="logViewerInstance"
                        ref="logViewer"
                        :dark="$root.isDark"
                        :follow="logFollow"
                        @follow-change="handleLogFollowChange"
                        @selection-change="logHasSelection = $event"
                    />
                </div>
            </BModal>
        </div>
    </transition>
</template>

<script>
import { BDropdown, BDropdownItem, BModal } from "bootstrap-vue-next";
import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { markRaw } from "vue";
import { isKnownBinaryFileName, isLogFileName } from "../../../common/file-types";
import FileLogViewer from "../components/FileLogViewer.vue";
import FileTextEditor from "../components/FileTextEditor.vue";

function getRouteDirectory(value) {
    if (Array.isArray(value)) {
        value = value[0];
    }
    return typeof value === "string" ? value.replace(/^\/+|\/+$/g, "") : "";
}

export default {
    components: { BDropdown,
        BDropdownItem,
        BModal,
        FileLogViewer,
        FileTextEditor },
    data() {
        return {
            selectedEndpoint: this.$route.params.endpoint || "",
            info: { enabled: false,
                maxFileSize: 0,
                textFileSize: 0,
                chunkSize: 256 * 1024 },
            loadingInfo: true,
            busy: false,
            currentPath: getRouteDirectory(this.$route.query.path),
            entries: [],
            total: 0,
            offset: 0,
            limit: 200,
            dragActive: false,
            transfer: null,
            transferCancelled: false,
            activeTransferId: null,
            activeTransferType: null,
            showCreate: false,
            createType: "directory",
            newName: "",
            showRename: false,
            renameName: "",
            showMove: false,
            moveDestination: "",
            showDelete: false,
            showEditor: false,
            editorSession: 0,
            showLogViewer: false,
            logViewerInstance: 0,
            logSession: 0,
            logTimer: null,
            logReadingSession: null,
            logLoading: false,
            logFollow: true,
            logHasSelection: false,
            logHasNewContent: false,
            logEntry: null,
            logOffset: undefined,
            logFileId: undefined,
            logNotice: "",
            logError: "",
            activeEntry: null,
            editor: { name: "",
                path: "",
                content: "",
                revision: "",
                languageName: this.$t("plainText"),
                languageSupport: undefined },
        };
    },
    computed: {
        endpointOptions() {
            return Object.entries(this.$root.agentList).map(([ value, agent ]) => ({
                value,
                label: value === "" ? this.$t("currentEndpoint") : agent.name || value,
                offline: this.$root.agentStatusList[value] !== "online",
            }));
        },
        breadcrumbs() {
            const result = [];
            let current = "";
            for (const segment of this.currentPath.split("/").filter(Boolean)) {
                current = current ? `${current}/${segment}` : segment;
                result.push({ name: segment,
                    path: current });
            }
            return result;
        },
    },
    watch: {
        $route(to) {
            const endpoint = to.params.endpoint || "";
            const path = getRouteDirectory(to.query.path);
            const endpointChanged = endpoint !== this.selectedEndpoint;
            const pathChanged = path !== this.currentPath;

            this.selectedEndpoint = endpoint;
            this.currentPath = path;
            this.offset = 0;

            if (endpointChanged) {
                this.showEditor = false;
                this.showLogViewer = false;
                this.stopLogPolling();
                this.loadInfo();
            } else if (pathChanged && this.info.enabled) {
                this.refresh();
            }
        },
        showLogViewer(value) {
            if (!value) {
                this.stopLogPolling();
            }
        },
    },
    mounted() {
        this.loadInfo();
    },
    beforeUnmount() {
        this.cancelTransfer();
        this.stopLogPolling();
    },
    methods: {
        emit(event, request = {}) {
            return new Promise(resolve => this.$root.emitAgent(this.selectedEndpoint, event, request, resolve));
        },
        async loadInfo() {
            this.loadingInfo = true;
            const result = await new Promise(resolve => this.$root.emitAgent(this.selectedEndpoint, "fileManagerInfo", resolve));
            this.loadingInfo = false;
            if (!result.ok) {
                this.info = { enabled: false };
                this.$root.toastRes(result);
                return;
            }
            this.info = result;
            this.offset = 0;
            if (result.enabled) {
                await this.refresh();
            }
        },
        switchEndpoint() {
            this.$router.push(this.selectedEndpoint ? { name: "filesEndpoint",
                params: { endpoint: this.selectedEndpoint } } : { name: "files" });
        },
        async refresh() {
            this.busy = true;
            const result = await this.emit("fileList", { path: this.currentPath,
                offset: this.offset,
                limit: this.limit });
            this.busy = false;
            if (result.ok) {
                this.entries = result.entries;
                this.total = result.total;
            } else {
                this.$root.toastRes(result);
            }
        },
        openDirectory(path) {
            const directory = getRouteDirectory(path);
            if (directory === this.currentPath) {
                this.offset = 0;
                this.refresh();
                return;
            }

            const query = { ...this.$route.query };
            if (directory) {
                query.path = directory;
            } else {
                delete query.path;
            }
            this.$router.push({ path: this.$route.path,
                query });
        },
        openEntry(entry) {
            if (entry.type === "directory") {
                this.openDirectory(entry.path);
            } else if (entry.type === "file") {
                if (this.isKnownBinary(entry)) {
                    this.$root.toastRes({ ok: false,
                        msg: this.$t("binaryPreviewUnsupported") });
                } else if (this.isLogEntry(entry) || this.isEditTooLarge(entry)) {
                    this.openLog(entry);
                } else {
                    this.edit(entry);
                }
            }
        },
        isKnownBinary(entry) {
            return entry.type === "file" && isKnownBinaryFileName(entry.name);
        },
        isLogEntry(entry) {
            return entry.type === "file" && isLogFileName(entry.name);
        },
        isEditTooLarge(entry) {
            return entry.type === "file" && entry.size > this.info.textFileSize;
        },
        canView(entry) {
            return entry.type === "file" && !this.isKnownBinary(entry);
        },
        joinPath(parent, name) {
            return [ parent, name ].filter(Boolean).join("/");
        },
        openCreate(type) {
            this.createType = type;
            this.newName = "";
            this.showCreate = true;
        },
        async createEntry(event) {
            if (!this.newName.trim()) {
                event?.preventDefault?.();
                return;
            }
            const path = this.joinPath(this.currentPath, this.newName.trim());
            const result = await this.emit(this.createType === "directory" ? "fileCreateDirectory" : "fileCreateTextFile", { path });
            this.$root.toastRes(result);
            if (result.ok) {
                this.showCreate = false;
                await this.refresh();
            } else {
                event?.preventDefault?.();
            }
        },
        openRename(entry) {
            this.activeEntry = entry;
            this.renameName = entry.name;
            this.showRename = true;
        },
        async renameEntry(event, overwrite = false) {
            const destination = this.joinPath(this.currentPath, this.renameName.trim());
            const result = await this.emit("fileRename", { source: this.activeEntry.path,
                destination,
                overwrite });
            if (!result.ok && result.code === "CONFLICT" && window.confirm(this.$t("confirmOverwrite"))) {
                event?.preventDefault?.();
                return this.renameEntry(event, true);
            }
            this.$root.toastRes(result);
            if (result.ok) {
                this.showRename = false;
                await this.refresh();
            } else {
                event?.preventDefault?.();
            }
        },
        openMove(entry) {
            this.activeEntry = entry;
            this.moveDestination = "";
            this.showMove = true;
        },
        async moveEntry(event, overwrite = false) {
            const directory = this.moveDestination.replace(/^\/+|\/+$/g, "");
            const destination = this.joinPath(directory, this.activeEntry.name);
            const result = await this.emit("fileMove", { source: this.activeEntry.path,
                destination,
                overwrite });
            if (!result.ok && result.code === "CONFLICT" && window.confirm(this.$t("confirmOverwrite"))) {
                event?.preventDefault?.();
                return this.moveEntry(event, true);
            }
            this.$root.toastRes(result);
            if (result.ok) {
                this.showMove = false;
                await this.refresh();
            } else {
                event?.preventDefault?.();
            }
        },
        openDelete(entry) {
            this.activeEntry = entry;
            this.showDelete = true;
        },
        async deleteEntry(event) {
            const result = await this.emit("fileDelete", { path: this.activeEntry.path,
                confirmed: true });
            this.$root.toastRes(result);
            if (result.ok) {
                this.showDelete = false;
                await this.refresh();
            } else {
                event?.preventDefault?.();
            }
        },
        async edit(entry) {
            if (this.isKnownBinary(entry)) {
                return this.$root.toastRes({ ok: false,
                    msg: this.$t("binaryPreviewUnsupported") });
            }
            if (this.isEditTooLarge(entry)) {
                return this.$root.toastRes({ ok: false,
                    msg: this.$t("fileTooLargeToEdit") });
            }
            this.busy = true;
            const result = await this.emit("fileReadText", { path: entry.path });
            if (!result.ok) {
                this.busy = false;
                return this.$root.toastRes(result);
            }

            const language = LanguageDescription.matchFilename(languages, entry.name);
            let languageSupport;
            if (language) {
                try {
                    languageSupport = markRaw(await language.load());
                } catch {
                    languageSupport = undefined;
                }
            }
            this.editor = { name: entry.name,
                path: entry.path,
                content: result.content,
                revision: result.revision,
                languageName: language?.name || this.$t("plainText"),
                languageSupport };
            this.editorSession++;
            this.busy = false;
            this.showEditor = true;
        },
        async saveEditor(event, force = false) {
            const content = this.$refs.textEditor?.getValue() ?? this.editor.content;
            const result = await this.emit("fileSaveText", { path: this.editor.path,
                content,
                revision: this.editor.revision,
                force });
            if (!result.ok && result.code === "CONFLICT" && window.confirm(this.$t("fileChangedConfirm"))) {
                event?.preventDefault?.();
                return this.saveEditor(event, true);
            }
            this.$root.toastRes(result);
            if (result.ok) {
                this.editor.revision = result.revision;
                this.showEditor = false;
                await this.refresh();
            } else {
                event?.preventDefault?.();
            }
        },
        async openLog(entry) {
            if (!this.canView(entry)) {
                return this.$root.toastRes({ ok: false,
                    msg: this.$t("binaryPreviewUnsupported") });
            }
            this.stopLogPolling();
            this.logEntry = entry;
            this.logFollow = true;
            this.logHasSelection = false;
            this.logHasNewContent = false;
            this.logNotice = "";
            this.logError = "";
            this.showLogViewer = true;
            this.logViewerInstance++;
            await this.$nextTick();
            this.reloadLog();
        },
        reloadLog() {
            if (!this.showLogViewer || !this.logEntry) {
                return;
            }
            this.clearLogTimer();
            const session = ++this.logSession;
            this.logOffset = undefined;
            this.logFileId = undefined;
            this.logNotice = "";
            this.logError = "";
            this.logHasNewContent = false;
            this.logLoading = true;
            this.$refs.logViewer?.clear();
            this.pollLog(session);
        },
        async pollLog(session) {
            if (session !== this.logSession || !this.showLogViewer || !this.logEntry || this.logReadingSession === session) {
                return;
            }
            this.logReadingSession = session;
            const request = { path: this.logEntry.path };
            if (this.logOffset !== undefined) {
                request.offset = this.logOffset;
                request.fileId = this.logFileId;
            }
            const result = await this.emit("fileLogRead", request);
            if (this.logReadingSession === session) {
                this.logReadingSession = null;
            }
            if (session !== this.logSession || !this.showLogViewer) {
                return;
            }
            this.logLoading = false;
            if (!result.ok) {
                this.logError = this.fileErrorMessage(result);
                return;
            }

            const wasFollowingExistingFile = this.logOffset !== undefined;
            if (result.reset && wasFollowingExistingFile) {
                this.logNotice = this.$t("logFileReset");
            }
            if (result.skippedBytes) {
                this.logNotice = this.$t("logContentSkipped", { size: this.formatSize(result.skippedBytes) });
            }
            this.$refs.logViewer?.append(result.content, result.reset);
            if (result.content && !this.logFollow) {
                this.logHasNewContent = true;
            }
            this.logOffset = result.nextOffset;
            this.logFileId = result.fileId;
            this.queueLogPoll(result.hasMore ? 0 : 1000, session);
        },
        queueLogPoll(delay, session) {
            this.clearLogTimer();
            this.logTimer = window.setTimeout(() => this.pollLog(session), delay);
        },
        clearLogTimer() {
            if (this.logTimer) {
                window.clearTimeout(this.logTimer);
                this.logTimer = null;
            }
        },
        stopLogPolling() {
            this.clearLogTimer();
            this.logSession++;
            this.logLoading = false;
        },
        toggleLogFollow() {
            if (this.logFollow) {
                this.logFollow = false;
            } else {
                this.resumeLogFollow();
            }
        },
        resumeLogFollow() {
            this.logFollow = true;
            this.logHasNewContent = false;
            this.$nextTick(() => this.$refs.logViewer?.scrollToEnd());
        },
        handleLogFollowChange(follow) {
            this.logFollow = follow;
        },
        copyLogSelection() {
            this.$refs.logViewer?.copySelection();
        },
        clearLogDisplay() {
            this.$refs.logViewer?.clear();
            this.logHasNewContent = false;
        },
        fileErrorMessage(result) {
            if (result.msgi18n) {
                return this.$t(result.msg);
            }
            return result.msg || this.$t("fileErrorGeneric");
        },
        selectFiles(event) {
            const files = [ ...event.target.files ];
            event.target.value = "";
            this.uploadFiles(files);
        },
        dropFiles(event) {
            this.dragActive = false;
            this.uploadFiles([ ...event.dataTransfer.files ]);
        },
        async uploadFiles(files) {
            this.busy = true;
            try {
                for (let index = 0; index < files.length; index++) {
                    if (this.transferCancelled) {
                        break;
                    }
                    await this.uploadFile(files[index], index, files.length);
                }
            } finally {
                this.transfer = null;
                this.transferCancelled = false;
                this.activeTransferId = null;
                this.activeTransferType = null;
                this.busy = false;
                await this.refresh();
            }
        },
        async uploadFile(file, index, count, overwrite = false) {
            const target = this.joinPath(this.currentPath, file.name);
            let start = await this.emit("fileUploadStart", { path: target,
                size: file.size,
                overwrite });
            if (!start.ok && start.code === "CONFLICT" && window.confirm(this.$t("confirmOverwriteFile", { name: file.name }))) {
                return this.uploadFile(file, index, count, true);
            }
            if (!start.ok) {
                return this.$root.toastRes(start);
            }
            this.activeTransferId = start.transferId;
            this.activeTransferType = "upload";
            let offset = 0;
            while (offset < file.size && !this.transferCancelled) {
                const end = Math.min(offset + this.info.chunkSize, file.size);
                const data = new Uint8Array(await file.slice(offset, end).arrayBuffer());
                const result = await this.emit("fileUploadChunk", { transferId: start.transferId,
                    offset,
                    data });
                if (!result.ok) {
                    await this.emit("fileUploadAbort", { transferId: start.transferId });
                    return this.$root.toastRes(result);
                }
                offset = result.offset;
                this.transfer = { label: `${this.$t("uploading")} ${file.name} (${index + 1}/${count})`,
                    percent: file.size === 0 ? 100 : Math.round(offset / file.size * 100) };
            }
            if (this.transferCancelled) {
                return this.emit("fileUploadAbort", { transferId: start.transferId });
            }
            const finish = await this.emit("fileUploadFinish", { transferId: start.transferId });
            if (!finish.ok) {
                this.$root.toastRes(finish);
            }
        },
        async download(entry) {
            this.busy = true;
            this.transferCancelled = false;
            const start = await this.emit("fileDownloadStart", { path: entry.path });
            if (!start.ok) {
                this.busy = false;
                return this.$root.toastRes(start);
            }
            this.activeTransferId = start.transferId;
            this.activeTransferType = "download";
            const chunks = [];
            let offset = 0;
            try {
                while (offset < start.size && !this.transferCancelled) {
                    const result = await this.emit("fileDownloadChunk", { transferId: start.transferId,
                        offset });
                    if (!result.ok) {
                        return this.$root.toastRes(result);
                    }
                    const data = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data);
                    chunks.push(data);
                    offset += data.byteLength;
                    this.transfer = { label: `${this.$t("downloading")} ${entry.name}`,
                        percent: start.size === 0 ? 100 : Math.round(offset / start.size * 100) };
                }
                if (!this.transferCancelled) {
                    const url = URL.createObjectURL(new Blob(chunks));
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = entry.name;
                    anchor.click();
                    setTimeout(() => URL.revokeObjectURL(url), 0);
                }
            } finally {
                await this.emit("fileDownloadFinish", { transferId: start.transferId });
                this.transfer = null;
                this.activeTransferId = null;
                this.activeTransferType = null;
                this.busy = false;
            }
        },
        async cancelTransfer() {
            this.transferCancelled = true;
            if (this.activeTransferId) {
                await this.emit(this.activeTransferType === "download" ? "fileDownloadFinish" : "fileUploadAbort", { transferId: this.activeTransferId });
            }
        },
        changePage(direction) {
            this.offset = Math.max(0, this.offset + direction * this.limit);
            this.refresh();
        },
        formatSize(bytes) {
            if (bytes < 1024) {
                return `${bytes} B`;
            }
            const units = [ "KiB", "MiB", "GiB" ];
            let value = bytes / 1024;
            let unit = units[0];
            for (let index = 1; value >= 1024 && index < units.length; index++) {
                value /= 1024;
                unit = units[index];
            }
            return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
        },
        formatDate(value) {
            return new Intl.DateTimeFormat(this.$i18n.locale, { dateStyle: "medium",
                timeStyle: "short" }).format(new Date(value));
        },
    },
};
</script>

<style scoped lang="scss">
@import "../styles/vars.scss";

.page-header, .file-toolbar, .toolbar-actions, .row-actions, .pagination-bar {
    display: flex;
    align-items: center;
    gap: 0.65rem;
}

.page-header, .file-toolbar, .pagination-bar { justify-content: space-between; }
.endpoint-select { width: min(320px, 100%); }
.file-toolbar { padding: 0.8rem; }
.breadcrumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem; min-width: 0; }
.crumb, .file-name { padding: 0; border: 0; color: inherit; background: transparent; text-align: left; overflow-wrap: anywhere; }
.crumb:hover, .file-name:hover { color: $primary; }
.file-list { position: relative; overflow: hidden; min-height: 180px; }
.file-list.dragging { outline: 3px dashed $primary; outline-offset: -6px; }
.loading-overlay, .empty-state { padding: 3rem 1rem; text-align: center; color: $dark-font-color3; }
.row-actions { justify-content: flex-end; flex-wrap: wrap; }
.mobile-file-cards { display: none; }
.transfer-panel { position: fixed; z-index: 1500; right: 1rem; bottom: 1rem; width: min(420px, calc(100vw - 2rem)); padding: 1rem; }
.editor-meta { display: flex; flex: 0 0 auto; justify-content: flex-end; gap: 0.5rem; margin-bottom: 0.5rem; color: $dark-font-color3; font-size: 0.8rem; }
.editor-meta span { padding: 0.15rem 0.5rem; border: 1px solid rgba(127,127,127,.25); border-radius: 0.35rem; }
.text-editor { display: flex; overflow: hidden; flex: 1 1 auto; min-height: 0; border: 1px solid rgba(127,127,127,.3); border-radius: 0.4rem; font-family: 'JetBrains Mono', monospace; font-size: 14px; }
.text-editor :deep(.file-text-editor), .text-editor :deep(.cm-editor) { width: 100%; height: 100%; min-height: 0; }
.text-editor :deep(.cm-scroller) { overflow: auto; }
.log-viewer-toolbar { display: flex; flex: 0 0 auto; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem; }
.log-viewer-toolbar .active { color: #fff; background: $primary; }
.log-viewer-status { align-self: center; color: $dark-font-color3; }
.log-viewer-body { display: flex; overflow: hidden; flex: 1 1 auto; min-height: 0; border: 1px solid rgba(127,127,127,.3); border-radius: 0.4rem; font-family: 'JetBrains Mono', monospace; font-size: 14px; }
:global(.file-editor-modal) { overflow: hidden; }
:global(.file-editor-modal .modal-dialog) { height: calc(100dvh - 3.5rem); }
:global(.file-editor-modal .modal-content) { height: 100%; max-height: calc(100dvh - 3.5rem); border-radius: 0.5rem; }
:global(.file-editor-modal .modal-header), :global(.file-editor-modal .modal-footer) { flex: 0 0 auto; }
:global(.file-editor-modal .modal-body) { display: flex; overflow: hidden; flex: 1 1 auto; flex-direction: column; min-height: 0; }
:global(.file-log-modal) { overflow: hidden; }
:global(.file-log-modal .modal-dialog) { height: calc(100dvh - 3.5rem); }
:global(.file-log-modal .modal-content) { height: 100%; max-height: calc(100dvh - 3.5rem); border-radius: 0.5rem; }
:global(.file-log-modal .modal-header) { flex: 0 0 auto; }
:global(.file-log-modal .modal-body) { display: flex; overflow: hidden; flex: 1 1 auto; flex-direction: column; min-height: 0; }

.files-page {
    .dark & .text-muted {
        color: $dark-font-color !important;
    }
}

.desktop-file-table {
    .dark & .table {
        --bs-table-bg: transparent;
        --bs-table-color: #d8dee4;
        --bs-table-border-color: #{$dark-border-color};
    }

    .dark & thead th {
        color: #d8dee4;
        background-color: $dark-header-bg;
        border-color: $dark-border-color;
    }
}

@media (max-width: 767.98px) {
    .page-header { align-items: stretch; flex-direction: column; }
    .endpoint-select { width: 100%; }
    .file-toolbar { align-items: stretch; flex-direction: column; }
    .toolbar-actions { display: grid; grid-template-columns: repeat(2, 1fr); }
    .toolbar-actions .btn { min-width: 0; padding-inline: 0.6rem; }
    .desktop-file-table { display: none; }
    .mobile-file-cards { display: block; }
    .file-card { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; border-bottom: 1px solid rgba(127,127,127,.2); }
    .file-card-main { display: flex; align-items: center; flex: 1; gap: 0.75rem; min-width: 0; padding: 0; border: 0; color: inherit; background: transparent; text-align: left; }
    .file-card-main span { display: flex; overflow: hidden; flex-direction: column; min-width: 0; }
    .file-card-main strong { overflow: hidden; text-overflow: ellipsis; }
    .file-card-main small { color: $dark-font-color3; }
    .file-card-icon { flex: 0 0 auto; font-size: 1.4rem; color: $primary; }
    .file-card-actions { display: flex; flex: 0 0 auto; gap: 0.25rem; }
    .pagination-bar { flex-wrap: wrap; }
    .transfer-panel { bottom: calc(70px + env(safe-area-inset-bottom)); }
    :global(.file-editor-modal .modal-dialog) { width: 100%; max-width: none; height: 100dvh; margin: 0; }
    :global(.file-editor-modal .modal-content) { height: 100dvh; max-height: 100dvh; border-radius: 0; }
    :global(.file-log-modal .modal-dialog) { width: 100%; max-width: none; height: 100dvh; margin: 0; }
    :global(.file-log-modal .modal-content) { height: 100dvh; max-height: 100dvh; border-radius: 0; }
    .text-editor { font-size: 16px; }
    .log-viewer-body { font-size: 16px; }
    .log-viewer-toolbar .btn { min-height: 44px; }
}
</style>
