<template>
    <BModal v-model="show" size="lg" :title="$t('gitStatus')" @hide="onHide">
        <div v-if="loading" class="text-center">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>

        <div v-else-if="!isGitRepo" class="alert alert-warning">
            {{ $t('notGitRepository') }}
        </div>

        <div v-else>
            <!-- Git Status Info -->
            <div class="mb-3">
                <strong>{{ $t('branch') }}:</strong> {{ gitStatus.current }}
                <span v-if="gitStatus.tracking"> → {{ gitStatus.tracking }}</span>
            </div>

            <div v-if="gitStatus.ahead > 0 || gitStatus.behind > 0" class="mb-3">
                <span v-if="gitStatus.ahead > 0" class="badge bg-info me-2">
                    ↑ {{ gitStatus.ahead }} {{ $t('commitsAhead') }}
                </span>
                <span v-if="gitStatus.behind > 0" class="badge bg-warning">
                    ↓ {{ gitStatus.behind }} {{ $t('commitsBehind') }}
                </span>
            </div>

            <!-- Unstaged Files List -->
            <div v-if="unstagedFiles.length > 0" class="mb-4">
                <h6 class="section-title unstaged-title">
                    <font-awesome-icon icon="circle" class="me-2 unstaged-icon" />
                    {{ $t('unstagedChanges') }}
                    <span class="badge bg-secondary ms-2">{{ unstagedFiles.length }}</span>
                </h6>
                <div class="file-list unstaged-list">
                    <div v-for="file in unstagedFiles" :key="file.path" class="file-item unstaged-item">
                        <div class="file-item-content">
                            <input
                                :id="'file-' + file.path"
                                v-model="selectedFiles"
                                type="checkbox"
                                :value="file.path"
                                class="form-check-input file-checkbox"
                            />
                            <span :class="getFileStatusClass(file.status)" class="file-status-badge">
                                {{ file.status }}
                            </span>
                            <span class="file-path text-monospace">{{ file.path }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Staged Files List -->
            <div v-if="stagedFiles.length > 0" class="mb-4">
                <h6 class="section-title staged-title">
                    <font-awesome-icon icon="check-circle" class="me-2 staged-icon" />
                    {{ $t('stagedChanges') }}
                    <span class="badge bg-success ms-2">{{ stagedFiles.length }}</span>
                </h6>
                <div class="file-list staged-list">
                    <div v-for="file in stagedFiles" :key="file.path" class="file-item staged-item">
                        <div class="file-item-content">
                            <input
                                :id="'staged-file-' + file.path"
                                v-model="selectedStagedFiles"
                                type="checkbox"
                                :value="file.path"
                                class="form-check-input file-checkbox"
                            />
                            <span :class="getFileStatusClass(file.status)" class="file-status-badge">
                                {{ file.status }}
                            </span>
                            <span class="file-path text-monospace">{{ file.path }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="gitStatus.files.length === 0" class="alert alert-info">
                {{ $t('noChanges') }}
            </div>

            <!-- Commit Message -->
            <div v-if="stagedFiles.length > 0" class="mb-3">
                <label for="commitMessage" class="form-label">{{ $t('commitMessage') }}</label>
                <input
                    id="commitMessage"
                    v-model="commitMessage"
                    type="text"
                    class="form-control"
                    :placeholder="$t('commitMessagePlaceholder')"
                />
            </div>

            <!-- Credentials Dialog -->
            <div v-if="showCredentialsDialog" class="mb-3">
                <div class="alert alert-info">
                    {{ $t('gitCredentialsRequired') }}
                </div>
                <div class="mb-2">
                    <label for="gitUsername" class="form-label">{{ $t('username') }}</label>
                    <input
                        id="gitUsername"
                        v-model="credentials.username"
                        type="text"
                        class="form-control"
                        :placeholder="$t('githubUsername')"
                    />
                </div>
                <div class="mb-2">
                    <label for="gitPassword" class="form-label">{{ $t('Password') }} / {{ $t('token') }}</label>
                    <input
                        id="gitPassword"
                        v-model="credentials.password"
                        type="password"
                        class="form-control"
                        :placeholder="$t('githubPasswordOrToken')"
                    />
                </div>
            </div>
        </div>

        <template #footer>
            <button class="btn btn-secondary" @click="onHide">
                {{ $t('close') }}
            </button>
            <button
                v-if="isGitRepo && selectedFiles.length > 0"
                class="btn btn-primary"
                :disabled="processing"
                @click="addFiles"
            >
                <font-awesome-icon icon="plus" class="me-1" />
                {{ $t('addFiles') }}
            </button>
            <button
                v-if="isGitRepo && selectedStagedFiles.length > 0"
                class="btn btn-warning"
                :disabled="processing"
                @click="unstageFiles"
            >
                <font-awesome-icon icon="minus" class="me-1" />
                {{ $t('unstageFiles') }}
            </button>
            <button
                v-if="isGitRepo && gitStatus.files.some(f => f.staged)"
                class="btn btn-success"
                :disabled="processing || !commitMessage"
                @click="commitAndPush"
            >
                <font-awesome-icon icon="upload" class="me-1" />
                {{ $t('commitAndPush') }}
            </button>
            <button
                v-if="isGitRepo && gitStatus.behind > 0"
                class="btn btn-info"
                :disabled="processing"
                @click="pullChanges"
            >
                <font-awesome-icon icon="download" class="me-1" />
                {{ $t('pull') }}
            </button>
        </template>
    </BModal>
</template>

<script>
import { BModal } from "bootstrap-vue-next";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

export default {
    components: {
        BModal,
        FontAwesomeIcon,
    },
    props: {
        stackName: {
            type: String,
            required: true,
        },
        endpoint: {
            type: String,
            default: "",
        },
    },
    data() {
        return {
            show: false,
            loading: false,
            processing: false,
            isGitRepo: true,
            gitStatus: {
                files: [],
                current: "",
                tracking: null,
                ahead: 0,
                behind: 0,
            },
            selectedFiles: [],
            selectedStagedFiles: [],
            commitMessage: "",
            showCredentialsDialog: false,
            credentials: {
                username: "",
                password: "",
            },
        };
    },
    computed: {
        unstagedFiles() {
            return this.gitStatus.files.filter(f => !f.staged);
        },
        stagedFiles() {
            return this.gitStatus.files.filter(f => f.staged);
        },
    },
    methods: {
        async open() {
            this.show = true;
            await this.loadGitStatus();
            await this.checkCredentials();
        },

        onHide() {
            this.show = false;
            this.selectedFiles = [];
            this.selectedStagedFiles = [];
            this.commitMessage = "";
            this.showCredentialsDialog = false;
            this.credentials = { username: "",
                password: "" };
        },

        async loadGitStatus() {
            this.loading = true;
            this.$root.emitAgent(this.endpoint, "getGitStatus", this.stackName, (res) => {
                this.loading = false;
                if (res.ok) {
                    if (res.gitStatus) {
                        this.gitStatus = res.gitStatus;
                        this.isGitRepo = true;
                    } else {
                        this.isGitRepo = false;
                    }
                } else {
                    this.isGitRepo = false;
                    this.$root.toastError(res.msg || "Failed to get git status");
                }
            });
        },

        async checkCredentials() {
            this.$root.emitAgent(this.endpoint, "getGitCredentials", (res) => {
                if (res.ok && !res.hasCredentials) {
                    this.showCredentialsDialog = true;
                }
            });
        },

        async addFiles() {
            if (this.selectedFiles.length === 0) {
                return;
            }

            this.processing = true;
            this.$root.emitAgent(this.endpoint, "gitAddFiles", this.stackName, this.selectedFiles, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.selectedFiles = [];
                    this.loadGitStatus();
                }
            });
        },

        async unstageFiles() {
            if (this.selectedStagedFiles.length === 0) {
                return;
            }

            this.processing = true;
            this.$root.emitAgent(this.endpoint, "gitUnstageFiles", this.stackName, this.selectedStagedFiles, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.selectedStagedFiles = [];
                    this.loadGitStatus();
                }
            });
        },

        async commitAndPush() {
            if (!this.commitMessage) {
                this.$root.toastError(this.$t("pleaseEnterCommitMessage"));
                return;
            }

            this.processing = true;

            // First commit
            this.$root.emitAgent(this.endpoint, "gitCommit", this.stackName, this.commitMessage, (res) => {
                if (res.ok) {
                    // Then push
                    const creds = this.credentials.username && this.credentials.password
                        ? this.credentials
                        : null;

                    this.$root.emitAgent(this.endpoint, "gitPush", this.stackName, creds, (pushRes) => {
                        this.processing = false;
                        this.$root.toastRes(pushRes);
                        if (pushRes.ok) {
                            this.commitMessage = "";
                            this.showCredentialsDialog = false;
                            this.loadGitStatus();
                        }
                    });
                } else {
                    this.processing = false;
                    this.$root.toastRes(res);
                }
            });
        },

        async pullChanges() {
            this.processing = true;

            const creds = this.credentials.username && this.credentials.password
                ? this.credentials
                : null;

            this.$root.emitAgent(this.endpoint, "gitPull", this.stackName, creds, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.showCredentialsDialog = false;
                    this.loadGitStatus();
                }
            });
        },

        getFileStatusClass(status) {
            const statusClasses = {
                "modified": "badge bg-warning",
                "untracked": "badge bg-secondary",
                "new file": "badge bg-success",
                "deleted": "badge bg-danger",
                "renamed": "badge bg-info",
                "staged": "badge bg-primary",
            };
            return statusClasses[status] || "badge bg-secondary";
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.section-title {
    font-weight: 600;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    font-size: 0.95rem;
}

.unstaged-title {
    color: $warning;
}

.staged-title {
    color: #86e6a9;
}

.unstaged-icon {
    color: $warning;
    font-size: 0.85rem;
}

.staged-icon {
    color: #86e6a9;
    font-size: 0.85rem;
}

.file-list {
    max-height: 300px;
    overflow-y: auto;
    border-radius: 0.5rem;
    padding: 0.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;

    .dark & {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
        background-color: $dark-bg2;
        border-color: $dark-border-color;
    }
}

.unstaged-list {
    border-left: 3px solid $warning;

    .dark & {
        background-color: $dark-bg2;
        border-color: $dark-border-color;
    }
}

.staged-list {
    background: linear-gradient(135deg, #f0f9f4 0%, #e7faec 100%);
    border: 1px solid #86e6a9;
    border-left: 3px solid #86e6a9;

    .dark & {
        background: linear-gradient(135deg, rgba(134, 230, 169, 0.1) 0%, rgba(134, 230, 169, 0.05) 100%);
        border-color: #86e6a9;
    }
}

.file-item {
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: 0.375rem;
    transition: all 0.2s ease;
    cursor: pointer;
}

.unstaged-item {
    background-color: #ffffff;
    border: 1px solid #e9ecef;

    &:hover {
        background-color: #f8f9fa;
        border-color: $warning;
        transform: translateX(2px);
        box-shadow: 0 2px 4px rgba(248, 163, 6, 0.2);
    }

    .dark & {
        background-color: $dark-bg;
        border-color: $dark-border-color;

        &:hover {
            background-color: lighten($dark-bg, 3%);
            border-color: $warning;
            box-shadow: 0 2px 8px rgba(248, 163, 6, 0.3);
        }
    }
}

.staged-item {
    background-color: #ffffff;
    border: 1px solid #d1e7dd;

    &:hover {
        background-color: #f0f9f4;
        border-color: #86e6a9;
        transform: translateX(2px);
        box-shadow: 0 2px 4px rgba(134, 230, 169, 0.2);
    }

    .dark & {
        background-color: rgba(134, 230, 169, 0.05);
        border-color: rgba(134, 230, 169, 0.3);

        &:hover {
            background-color: rgba(134, 230, 169, 0.1);
            border-color: #86e6a9;
            box-shadow: 0 2px 8px rgba(134, 230, 169, 0.3);
        }
    }
}

.file-item:last-child {
    margin-bottom: 0;
}

.file-item-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
}

.file-checkbox {
    margin: 0;
    cursor: pointer;
    flex-shrink: 0;
    width: 1.1em;
    height: 1.1em;
}

.file-checkbox:checked {
    background-color: $primary;
    border-color: $primary;
}

.file-status-badge {
    flex-shrink: 0;
    font-size: 0.75rem;
    padding: 0.25em 0.6em;
    font-weight: 500;
    text-transform: capitalize;
    letter-spacing: 0.3px;
}

.file-path {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 0.875rem;
    color: #495057;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.dark .file-path {
    color: $dark-font-color;
}

.staged-item .file-path {
    color: #155724;
    font-weight: 500;
}

.dark .staged-item .file-path {
    color: #86e6a9;
}

.unstaged-item .file-path {
    color: #495057;
}

.dark .unstaged-item .file-path {
    color: $dark-font-color;
}

/* Custom scrollbar for file lists */
.file-list::-webkit-scrollbar {
    width: 8px;
}

.file-list::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
}

.dark .file-list::-webkit-scrollbar-track {
    background: $dark-bg;
}

.file-list::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
}

.dark .file-list::-webkit-scrollbar-thumb {
    background: $dark-border-color;
}

.file-list::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
}

.dark .file-list::-webkit-scrollbar-thumb:hover {
    background: lighten($dark-border-color, 10%);
}

.text-monospace {
    font-family: monospace;
    font-size: 0.9rem;
}
</style>
