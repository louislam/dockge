<template>
    <div>
        <form class="my-4" autocomplete="off" @submit.prevent="saveApiKey">
            <h4 class="mb-3">{{ $t("Home Assistant API") }}</h4>

            <div class="mb-3">
                <span class="badge" :class="configured ? 'bg-success' : 'bg-secondary'">
                    {{ configured ? $t("Configured") : $t("Not configured") }}
                </span>
                <span v-if="source" class="ms-2 text-muted">
                    {{ source === "environment" ? "DOCKGE_API_KEY" : $t("Dockge settings") }}
                </span>
            </div>

            <div class="mb-3">
                <label for="apiKey" class="form-label">{{ $t("API Key") }}</label>
                <div class="input-group">
                    <input
                        id="apiKey"
                        v-model="apiKey"
                        class="form-control font-monospace"
                        :type="showApiKey ? 'text' : 'password'"
                        autocomplete="new-password"
                        minlength="32"
                        :placeholder="$t('Enter or generate an API key')"
                    />
                    <button
                        class="btn btn-outline-secondary"
                        type="button"
                        :title="showApiKey ? $t('Hide') : $t('Show')"
                        @click="showApiKey = !showApiKey"
                    >
                        <font-awesome-icon :icon="showApiKey ? 'eye-slash' : 'eye'" />
                    </button>
                    <button
                        class="btn btn-outline-secondary"
                        type="button"
                        :title="$t('Copy')"
                        :disabled="!apiKey"
                        @click="copyApiKey"
                    >
                        <font-awesome-icon icon="copy" />
                    </button>
                </div>
            </div>

            <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-primary" type="submit" :disabled="apiKey.trim().length < 32">
                    {{ $t("Save") }}
                </button>
                <button class="btn btn-outline-primary" type="button" @click="generateApiKey">
                    <font-awesome-icon icon="rotate" class="me-1" />
                    {{ $t("Generate") }}
                </button>
                <button class="btn btn-outline-danger" type="button" :disabled="!configured" @click="revokeApiKey">
                    <font-awesome-icon icon="trash" class="me-1" />
                    {{ $t("Revoke") }}
                </button>
            </div>
        </form>
    </div>
</template>

<script>
export default {
    data() {
        return {
            apiKey: "",
            configured: false,
            source: null,
            showApiKey: false,
        };
    },

    mounted() {
        this.loadApiKeyStatus();
    },

    methods: {
        loadApiKeyStatus() {
            this.$root.getSocket().emit("getApiKeyStatus", (res) => {
                if (res.ok) {
                    this.configured = res.configured;
                    this.source = res.source;
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        saveApiKey() {
            this.$root.getSocket().emit("setApiKey", this.apiKey, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.configured = true;
                    this.source = "settings";
                }
            });
        },

        generateApiKey() {
            this.$root.getSocket().emit("generateApiKey", (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.apiKey = res.apiKey;
                    this.configured = true;
                    this.source = "settings";
                    this.showApiKey = true;
                }
            });
        },

        revokeApiKey() {
            this.$root.getSocket().emit("revokeApiKey", (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.apiKey = "";
                    this.loadApiKeyStatus();
                }
            });
        },

        async copyApiKey() {
            await navigator.clipboard.writeText(this.apiKey);
            this.$root.toastSuccess(this.$t("Copied"));
        },
    },
};
</script>
