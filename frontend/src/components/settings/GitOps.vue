<template>
    <div>
        <form class="my-4" autocomplete="off" @submit.prevent="saveGitOps">
            <!-- Enable Auto Updates -->
            <div class="mb-4">
                <label class="form-label" for="gitAutoUpdate">
                    {{ $t("gitAutoUpdate") }}
                </label>

                <div class="form-check form-switch my-3">
                    <input id="git-auto-update" v-model="settings.gitAutoUpdate" class="form-check-input" type="checkbox">
                    <label class="form-check-label">
                        {{ $t("enableAutoUpdate") }}
                    </label>
                </div>

                <div class="form-text"></div>
            </div>

            <!-- Save Button -->
            <div>
                <button class="btn btn-primary" type="submit">
                    {{ $t("Save") }}
                </button>
            </div>
        </form>
    </div>
</template>

<script>

export default {
    data() {
        return {};
    },

    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        }
    },

    methods: {
        /** Save the settings */
        saveGitOps() {
            this.saveSettings();
        },
    },
};
</script>
<style scoped lang="scss">
@import "../../styles/vars.scss";
</style>

