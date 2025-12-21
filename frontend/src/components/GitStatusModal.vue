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

            <!-- Files List -->
            <div v-if="gitStatus.files.length > 0" class="mb-3">
                <h6>{{ $t('changedFiles') }}:</h6>
                <div class="file-list">
                    <div v-for="file in gitStatus.files" :key="file.path" class="file-item d-flex align-items-center mb-2">
                        <input
                            v-if="!file.staged"
                            :id="'file-' + file.path"
                            v-model="selectedFiles"
                            type="checkbox"
                            :value="file.path"
                            class="form-check-input me-2"
                        />
                        <span v-else class="me-2">✓</span>
                        <span :class="getFileStatusClass(file.status)" class="me-2">
                            {{ file.status }}
                        </span>
                        <span class="text-monospace">{{ file.path }}</span>
                    </div>
                </div>
            </div>

            <div v-else class="alert alert-info">
                {{ $t('noChanges') }}
            </div>

            <!-- Commit Message -->
            <div v-if="gitStatus.files.length > 0" class="mb-3">
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
            commitMessage: "",
            showCredentialsDialog: false,
            credentials: {
                username: "",
                password: "",
            },
        };
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

<style scoped>
.file-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #dee2e6;
    border-radius: 0.25rem;
    padding: 0.5rem;
}

.file-item {
    padding: 0.25rem;
    border-bottom: 1px solid #f0f0f0;
}

.file-item:last-child {
    border-bottom: none;
}

.text-monospace {
    font-family: monospace;
    font-size: 0.9rem;
}
</style>
