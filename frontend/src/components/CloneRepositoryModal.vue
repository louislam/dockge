<template>
    <BModal v-model="show" size="lg" :title="$t('cloneRepository')" @hide="onHide">
        <div v-if="loading" class="text-center">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>

        <div v-else>
            <!-- Repository URL -->
            <div class="mb-3">
                <label for="repoUrl" class="form-label">{{ $t('repositoryUrl') }}</label>
                <input
                    id="repoUrl"
                    v-model="repoUrl"
                    type="text"
                    class="form-control"
                    :placeholder="$t('repositoryUrlPlaceholder')"
                    required
                />
                <div class="form-text">{{ $t('repositoryUrlHelp') }}</div>
            </div>

            <!-- Stack Name -->
            <div class="mb-3">
                <label for="stackName" class="form-label">{{ $t('stackName') }}</label>
                <input
                    id="stackName"
                    v-model="stackName"
                    type="text"
                    class="form-control"
                    :placeholder="$t('stackNamePlaceholder')"
                    required
                    @blur="stackNameToLowercase"
                />
                <div class="form-text">{{ $t('Lowercase only') }}</div>
            </div>

            <!-- Agent/Endpoint Selection -->
            <div v-if="$root.agentCount > 1" class="mb-3">
                <label for="endpoint" class="form-label">{{ $t('dockgeAgent') }}</label>
                <select v-model="endpoint" class="form-select">
                    <option v-for="(agent, ep) in $root.agentList" :key="ep" :value="ep" :disabled="$root.agentStatusList[ep] != 'online'">
                        ({{ $root.agentStatusList[ep] }}) {{ (ep) ? ep : $t("currentEndpoint") }}
                    </option>
                </select>
            </div>

            <!-- Private Repository Notice -->
            <div v-if="needsCredentials" class="alert alert-info">
                {{ $t('privateRepositoryNotice') }}
            </div>

            <!-- Credentials Section -->
            <div v-if="needsCredentials" class="mb-3">
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
                    <label for="gitPassword" class="form-label">{{ $t('Password') }}</label>
                    <div class="form-text">{{ $t('githubPasswordOrToken') }}</div>
                    <input
                        id="gitPassword"
                        v-model="credentials.password"
                        type="password"
                        class="form-control"
                        :placeholder="$t('githubPasswordOrToken')"
                    />
                </div>
            </div>

            <!-- Toggle credentials -->
            <div v-if="!needsCredentials" class="mb-3">
                <button class="btn btn-sm btn-secondary" @click="needsCredentials = true">
                    {{ $t('addCredentials') }}
                </button>
            </div>
        </div>

        <template #footer>
            <button class="btn btn-secondary" @click="onHide">
                {{ $t('cancel') }}
            </button>
            <button
                class="btn btn-primary"
                :disabled="processing || !isValid"
                @click="cloneRepository"
            >
                <font-awesome-icon icon="clone" class="me-1" />
                {{ $t('clone') }}
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
    data() {
        return {
            show: false,
            loading: false,
            processing: false,
            repoUrl: "",
            stackName: "",
            endpoint: "",
            needsCredentials: false,
            credentials: {
                username: "",
                password: "",
            },
        };
    },
    computed: {
        isValid() {
            return this.repoUrl.trim() !== "" && this.stackName.trim() !== "";
        },
    },
    methods: {
        open() {
            this.show = true;
            this.endpoint = "";
            this.checkStoredCredentials();
        },

        onHide() {
            this.show = false;
            this.repoUrl = "";
            this.stackName = "";
            this.endpoint = "";
            this.needsCredentials = false;
            this.credentials = { username: "", password: "" };
        },

        async checkStoredCredentials() {
            this.$root.emitAgent(this.endpoint, "getGitCredentials", (res) => {
                if (res.ok && res.hasCredentials) {
                    // Credentials already stored, no need to show form initially
                    this.needsCredentials = false;
                }
            });
        },

        stackNameToLowercase() {
            this.stackName = this.stackName.toLowerCase();
        },

        async cloneRepository() {
            if (!this.isValid) {
                return;
            }

            this.processing = true;

            const creds = this.credentials.username && this.credentials.password
                ? this.credentials
                : null;

            this.$root.emitAgent(this.endpoint, "gitClone", this.repoUrl, this.stackName, creds, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.onHide();
                    // Navigate to the newly cloned stack
                    this.$router.push(`/compose/${this.stackName}`);
                }
            });
        },
    },
};
</script>

<style scoped>
.form-text {
    font-size: 0.875rem;
    color: #6c757d;
}
</style>
