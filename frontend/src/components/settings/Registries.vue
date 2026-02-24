<template>
    <div>
        <div v-if="settingsLoaded" class="my-4">
            <h5 class="my-4 settings-subheading">{{ $t("Configured Registries") }}</h5>
            <div class="table-responsive mb-4">
                <table class="table table-hover" v-if="registries.length > 0">
                    <thead>
                        <tr>
                            <th class="col">{{ $t("Registry URL") }}</th>
                            <th class="col">{{ $t("Username") }}</th>
                            <th class="col">{{ $t("Description") }}</th>
                            <th class="col text-end">{{ $t("Actions") }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="(registry, index) in registries"
                            :key="index"
                            :class="{'table-success': registry.enabled, 'table-secondary': !registry.enabled}"
                        >
                            <td>{{ registry.url }}</td>
                            <td>{{ registry.username }}</td>
                            <td>{{ registry.description || "-" }}</td>
                            <td class="text-end">
                                <button
                                    type="button"
                                    class="btn btn-sm btn-primary mb-1 mb-md-0 me-md-2"
                                    @click="editRegistry(index)"
                                >
                                    {{ $t("Edit") }}
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-sm btn-danger"
                                    @click="confirmDeleteRegistry(index)"
                                >
                                    {{ $t("Delete") }}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div v-else class="alert alert-info">
                    {{ $t("No registries configured yet") }}
                </div>
            </div>
            <h5 class="my-4 settings-subheading">
                {{
                    editIndex === -1
                        ? $t("Add New Registry")
                        : $t("Edit Registry")
                }}
            </h5>
            <form class="mb-3" @submit.prevent="saveRegistry">
                <!-- Registry URL -->
                <div class="mb-3">
                        <label for="registryUrl" class="form-label">{{
                            $t("Registry URL")
                        }}</label>
                        <input
                            id="registryUrl"
                            v-model="currentRegistry.url"
                            class="form-control"
                            :placeholder="
                                $t('e.g., docker.io, ghcr.io, gcr.io, quay.io')
                            "
                            required
                        />
                    </div>

                    <!-- Username -->
                    <div class="mb-3">
                        <label for="username" class="form-label">{{
                            $t("Username")
                        }}</label>
                        <input
                            id="username"
                            v-model="currentRegistry.username"
                            class="form-control"
                            :placeholder="$t('Username')"
                            required
                        />
                    </div>

                    <!-- Token/Password -->
                    <div class="mb-3">
                        <label for="token" class="form-label">{{
                            $t("Token")
                        }}</label>
                        <input
                            id="token"
                            v-model="currentRegistry.token"
                            type="password"
                            class="form-control"
                            :placeholder="$t('Your registry password or token')"
                            required
                        />
                        <div class="form-text">
                            {{
                                $t(
                                    "Use a Personal Access Token or your password if the registry supports it.",
                                )
                            }}
                        </div>
                    </div>

                    <!-- Description -->
                    <div class="mb-3">
                        <label for="description" class="form-label">{{
                            $t("Description")
                        }}</label>
                        <input
                            id="description"
                            v-model="currentRegistry.description"
                            class="form-control"
                            :placeholder="
                                $t('Optional description for this registry')
                            "
                        />
                    </div>

                    <!-- Enabled -->
                    <div class="mb-3 form-check">
                        <input
                            id="enabled"
                            v-model="currentRegistry.enabled"
                            type="checkbox"
                            class="form-check-input"
                        />
                        <label for="enabled" class="form-check-label">{{
                            $t("Enabled")
                        }}</label>
                        <div class="form-text">
                            {{ $t("Enable this registry for authentication") }}
                        </div>
                    </div>

                    <!-- Allow Insecure -->
                    <div class="mb-3 form-check">
                        <input
                            id="allowInsecure"
                            v-model="currentRegistry.allowInsecure"
                            type="checkbox"
                            class="form-check-input"
                        />
                        <label for="allowInsecure" class="form-check-label">{{
                            $t("Allow Insecure Connection")
                        }}</label>
                        <div class="form-text">
                            {{ $t("Allow HTTP connections") }}
                        </div>
                    </div>
                <!-- Submit buttons -->
                <div class="my-4">
                    <button type="submit" class="btn btn-primary">
                        {{ editIndex === -1 ? $t("Add") : $t("Save") }}
                    </button>
                    <button
                        v-if="editIndex !== -1"
                        type="button"
                        class="btn btn-secondary ms-2"
                        @click="cancelEdit"
                    >
                        {{ $t("Cancel") }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            registries: [],
            currentRegistry: this.getEmptyRegistry(),
            editIndex: -1,
        };
    },

    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        },
        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        },
    },

    mounted() {
        this.loadRegistries();
    },

    methods: {
        getEmptyRegistry() {
            return {
                url: "",
                username: "",
                token: "",
                description: "",
                enabled: true,
                allowInsecure: false,
            };
        },

        loadRegistries() {
            this.$root.getSocket().emit("getRegistries", (res) => {
                if (res.ok) {
                    this.registries = res.data || [];
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        saveRegistry() {
            const registry = { ...this.currentRegistry };

            if (this.editIndex === -1) {
                // Add new registry
                this.$root.getSocket().emit("addRegistry", registry, (res) => {
                    this.$root.toastRes(res);
                    if (res.ok) {
                        this.loadRegistries();
                        this.currentRegistry = this.getEmptyRegistry();
                    }
                });
            } else {
                // Update existing registry
                this.$root
                    .getSocket()
                    .emit("updateRegistry", this.editIndex, registry, (res) => {
                        this.$root.toastRes(res);
                        if (res.ok) {
                            this.loadRegistries();
                            this.currentRegistry = this.getEmptyRegistry();
                            this.editIndex = -1;
                        }
                    });
            }
        },

        editRegistry(index) {
            this.editIndex = index;
            this.currentRegistry = { ...this.registries[index] };
        },

        cancelEdit() {
            this.editIndex = -1;
            this.currentRegistry = this.getEmptyRegistry();
        },

        confirmDeleteRegistry(index) {
            if (
                confirm(
                    this.$t("Are you sure you want to delete this registry?"),
                )
            ) {
                this.deleteRegistry(index);
            }
        },

        deleteRegistry(index) {
            this.$root.getSocket().emit("deleteRegistry", index, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.loadRegistries();
                    if (this.editIndex === index) {
                        this.cancelEdit();
                    }
                }
            });
        },
    },
};
</script>
